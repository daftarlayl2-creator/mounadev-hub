// src/services/messageService.ts
import { getSupabase } from '../utils/supabase';
import { logger } from '../utils/logger';
import { contactService } from './contactService';
import { conversationService } from './conversationService';
import { ChannelAdapter, SendResult } from '../adapters/channelAdapter';

export interface Message {
  id: string;
  conversation_id: string;
  direction: 'outbound' | 'inbound';
  sender_type: 'agent' | 'customer' | 'system';
  sender_id?: string;
  content: string;
  message_type: string;
  template_name?: string;
  status: string;
  provider_message_id?: string;
  idempotency_key?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export class MessageService {
  private adapter: ChannelAdapter;

  constructor(adapter: ChannelAdapter) {
    this.adapter = adapter;
  }

  async send(params: {
    contactId: string;
    content: string;
    messageType?: string;
    idempotencyKey?: string;
    templateName?: string;
    variables?: Record<string, string>;
    agentId: string;
    isAdmin?: boolean;
  }): Promise<Message> {
    const { contactId, content, messageType = 'text', idempotencyKey, templateName, variables, agentId, isAdmin = false } = params;
    const assignedAgentScope = isAdmin ? undefined : agentId;

    // Resolve and authorize the contact before checking idempotency. The service
    // must remain safe even when called outside the HTTP route.
    const contact = await contactService.getById(contactId, assignedAgentScope);
    if (!contact) throw new Error('contact_not_found');

    // Idempotency is scoped to this sender and this authorized contact/conversation.
    if (idempotencyKey) {
      const existing = await this.getByIdempotencyKey(idempotencyKey, agentId, contactId, assignedAgentScope);
      if (existing) {
        logger.info('Duplicate message detected, returning existing', { agentId });
        return existing;
      }
    }

    // Check contact permission
    const perm = await contactService.checkPermission(contactId);
    if (!perm.allowed) throw new Error(perm.reason!);

    // 4. Get or create conversation
    let conversation = await conversationService.getByContact(contactId, assignedAgentScope);
    if (!conversation) {
      conversation = await conversationService.create(contactId, 'whatsapp', contact.assigned_agent || agentId);
    }

    // 5. Check 24h window (for Meta; OpenWA doesn't enforce)
    if (messageType !== 'template') {
      const expired = await conversationService.isWindowExpired(conversation.id);
      // Only enforce for Meta adapter; OpenWA has no window
      // For now, log warning but don't block for OpenWA
      if (expired) {
        logger.warn('24h window expired, consider using template', { conversation: conversation.id });
      }
    }

    // 6. Create message record (queued)
    const supabase = (await import('../utils/supabase')).getSupabase();
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        direction: 'outbound',
        sender_type: 'agent',
        sender_id: agentId,
        content,
        message_type: messageType,
        template_name: templateName,
        status: 'queued',
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create message: ${error.message}`);

    // 7. Send via channel adapter
    try {
      let result: SendResult;
      if (messageType === 'template' && templateName) {
        result = await this.adapter.sendTemplate(contact.phone, templateName, variables || {});
      } else {
        result = await this.adapter.sendText(contact.phone, content);
      }

      if (result.success) {
        await supabase
          .from('messages')
          .update({ status: 'sent', provider_message_id: result.messageId, updated_at: new Date().toISOString() })
          .eq('id', message.id);

        // Update conversation last_message_at
        await conversationService.update(conversation.id, { last_message_at: new Date().toISOString() });

        logger.info('Message sent', { messageId: message.id, providerId: result.messageId, agent: agentId });
        return { ...message, status: 'sent', provider_message_id: result.messageId };
      } else {
        await supabase
          .from('messages')
          .update({ status: 'failed', error_message: result.error, updated_at: new Date().toISOString() })
          .eq('id', message.id);
        throw new Error(`provider_error: ${result.error}`);
      }
    } catch (err: any) {
      await supabase
        .from('messages')
        .update({ status: 'failed', error_message: err.message, updated_at: new Date().toISOString() })
        .eq('id', message.id);
      throw err;
    }
  }

  async getByIdempotencyKey(
    key: string,
    senderId: string,
    contactId: string,
    assignedAgent?: string,
  ): Promise<Message | null> {
    const supabase = (await import('../utils/supabase')).getSupabase();
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('idempotency_key', key)
      .eq('sender_id', senderId)
      .maybeSingle();
    if (error || !data) return null;

    // A key collision from another contact must never disclose that message.
    const conversation = await conversationService.getById(data.conversation_id, assignedAgent);
    if (!conversation || conversation.contact_id !== contactId) return null;
    return data;
  }

  async getConversationMessages(conversationId: string, limit: number = 50): Promise<Message[]> {
    const supabase = (await import('../utils/supabase')).getSupabase();
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(`Failed to get messages: ${error.message}`);
    return data || [];
  }

  async updateStatus(messageId: string, status: string, providerMessageId?: string): Promise<void> {
    const supabase = (await import('../utils/supabase')).getSupabase();
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (providerMessageId) updates.provider_message_id = providerMessageId;
    await supabase.from('messages').update(updates).eq('id', messageId);
  }

  async storeInbound(params: {
    conversationId: string;
    content: string;
    senderPhone: string;
    providerMessageId: string;
    idempotencyKey?: string;
    messageType?: string;
  }): Promise<Message> {
    const supabase = (await import('../utils/supabase')).getSupabase();
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: params.conversationId,
        direction: 'inbound',
        sender_type: 'customer',
        sender_id: params.senderPhone,
        content: params.content,
        message_type: params.messageType || 'text',
        status: 'received',
        provider_message_id: params.providerMessageId,
        idempotency_key: params.idempotencyKey,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to store inbound message: ${error.message}`);

    // Update conversation window (reset 24h)
    await conversationService.update(params.conversationId, {
      last_message_at: new Date().toISOString(),
      window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    logger.info('Inbound message stored', { messageId: data.id, from: '***' + params.senderPhone.replace(/\\D/g, '').slice(-4) });
    return data;
  }
}

export const createMessageService = (adapter: any) => new MessageService(adapter);