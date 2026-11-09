// src/routes/webhooks.ts
import { Router, Request, Response } from 'express';
import { contactService } from '../services/contactService';
import { conversationService } from '../services/conversationService';
import { MessageService } from '../services/messageService';
import { OpenWAAdapter } from '../adapters/openwaAdapter';
import { automationService } from '../services/automationService';
import { aiReplyService } from '../services/aiReplyService';
import { config } from '../config';
import { logger } from '../utils/logger';
import { checkRateLimit } from '../middleware/rateLimiter';

const router = Router();
const adapter = new OpenWAAdapter();
const msgService = new MessageService(adapter);

interface PersistedInbound {
  msg: ReturnType<OpenWAAdapter['parseInbound']>[number];
  contact: Awaited<ReturnType<typeof contactService.getByPhone>>;
  conversation: Awaited<ReturnType<typeof conversationService.getByContact>>;
}

function getMessageIdempotencyKey(deliveryKey: string | undefined, messageId: string | undefined, index: number): string | undefined {
  if (!deliveryKey) return undefined;
  return messageId ? `${deliveryKey}:${messageId}` : `${deliveryKey}:${index}`;
}

// GET /webhooks/whatsapp — Meta verification
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && typeof token === 'string' && token === config.webhook.secret) {
    logger.info('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// POST /webhooks/whatsapp — Inbound messages
router.post('/whatsapp', async (req: Request, res: Response) => {
  try {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.get('x-openwa-signature') || undefined;
    if (!adapter.verifyWebhook(rawBody, signature)) {
      res.status(401).json({ error: 'invalid_webhook_signature' });
      return;
    }

    const inboundMessages = adapter.parseInbound(req.body);
    const deliveryIdempotencyKey = req.get('x-openwa-idempotency-key') || undefined;
    const persistedEvents: PersistedInbound[] = [];
    const supabase = (await import('../utils/supabase')).getSupabase();

    // Persist the complete delivery before acknowledging it. If a batch partially
    // persists and then fails, the provider retry safely skips already stored events.
    for (let index = 0; index < inboundMessages.length; index += 1) {
      const msg = inboundMessages[index];
      const idempotencyKey = getMessageIdempotencyKey(deliveryIdempotencyKey, msg.messageId, index);

      try {
        const contact = await contactService.getByPhone(msg.from) || await contactService.create({
          phone: msg.from,
          source: 'inbound',
          consent_status: 'none',
        });

        const conversation = await conversationService.getByContact(contact.id) ||
          await conversationService.create(contact.id, 'whatsapp', contact.assigned_agent);

        if (idempotencyKey) {
          const { data: duplicate, error } = await supabase
            .from('messages').select('id').eq('idempotency_key', idempotencyKey).maybeSingle();
          if (error) throw new Error('Unable to verify inbound delivery idempotency');
          if (duplicate) continue;
        }

        if (msg.messageId) {
          const { data: duplicate, error } = await supabase
            .from('messages').select('id').eq('provider_message_id', msg.messageId).maybeSingle();
          if (error) throw new Error('Unable to verify inbound message idempotency');
          if (duplicate) continue;
        }

        await msgService.storeInbound({
          conversationId: conversation.id,
          content: msg.content,
          senderPhone: msg.from,
          providerMessageId: msg.messageId,
          idempotencyKey,
          messageType: msg.type,
        });
        persistedEvents.push({ msg, contact, conversation });
      } catch (err: any) {
        logger.error('Failed to persist inbound message', {
          error: err.message,
          from: '***' + String(msg.from).slice(-4),
        });
        if (!res.headersSent) {
          res.status(500).json({ error: 'inbound_persistence_failed', message: 'Inbound event could not be persisted' });
        }
        return;
      }
    }

    // Acknowledge only after every event in this delivery is durable.
    res.status(200).json({ received: true, persisted: persistedEvents.length });

    // Automation is deliberately post-acknowledgement. A downstream failure must
    // not cause OpenWA to replay already persisted inbound messages.
    for (const event of persistedEvents) {
      const { msg, conversation } = event;
      let contact = event.contact;
      try {
        const isOptOut = automationService.isOptOutMessage(msg.content);
        const isComplaint = automationService.isComplaintOrSensitive(msg.content);

        if (isOptOut) {
          contact = await contactService.optOut(contact.id, 'keyword_detected', 'system');
          logger.info('Auto opt-out detected', { contact: contact.id });
        }

        if (isComplaint) {
          await automationService.escalateToHuman(conversation.id, 'mara', 'complaint_detected');
          logger.info('Complaint detected, escalated', { conversation: conversation.id });
        }

        const assignedAgent = isComplaint
          ? 'mara'
          : await automationService.routeInbound(contact.id, conversation.id);

        if (assignedAgent !== conversation.assigned_agent) {
          await conversationService.update(conversation.id, { assigned_agent: assignedAgent });
        }
        if (contact.assigned_agent !== assignedAgent) {
          contact = await contactService.update(contact.id, { assigned_agent: assignedAgent });
        }

        const waAgentId = contact.assigned_agent || assignedAgent || config.whatsappAgent.agentId;
        const canAutoReply = config.whatsappAgent.autoReply &&
          contact.consent_status !== 'opted_out' &&
          !isOptOut &&
          !isComplaint &&
          await automationService.shouldAutoReply(conversation.id);

        if (!canAutoReply) continue;

        try {
          const limit = await checkRateLimit(waAgentId, contact.id);
          if (!limit.allowed) {
            logger.warn('Webhook auto-reply blocked by outbound rate limit', { agent: waAgentId, reason: limit.reason });
            continue;
          }

          const recent = await msgService.getConversationMessages(conversation.id);
          const history = (recent || []).slice(-6).map((message: any) => ({
            role: message.direction === 'inbound' ? 'user' as const : 'assistant' as const,
            content: message.content,
          }));

          const aiResult = await aiReplyService.generateReply({
            agentId: waAgentId,
            customerMessage: msg.content,
            conversationHistory: history.slice(0, -1),
            contactName: contact.name,
            businessName: contact.business_name,
          });

          if (!aiResult.success || !aiResult.reply) {
            logger.warn('AI auto-reply not sent', { error: aiResult.error });
            continue;
          }

          const sendResult = await adapter.sendText(contact.phone, aiResult.reply);
          if (!sendResult.success) {
            logger.error('AI auto-reply send failed', { error: sendResult.error });
            continue;
          }

          const { error: insertError } = await supabase.from('messages').insert({
            conversation_id: conversation.id,
            direction: 'outbound',
            sender_type: 'agent',
            sender_id: waAgentId,
            content: aiResult.reply,
            message_type: 'text',
            status: 'sent',
            provider_message_id: sendResult.messageId,
          });
          if (insertError) {
            logger.error('AI auto-reply sent but message record could not be stored', { conversation: conversation.id });
            continue;
          }

          await conversationService.update(conversation.id, { last_message_at: new Date().toISOString() });
          logger.info('AI auto-reply sent', { conversation: conversation.id, agent: waAgentId });
        } catch (aiErr: any) {
          logger.error('AI auto-reply error', { error: aiErr.message });
        }
      } catch (err: any) {
        logger.error('Post-acknowledgement inbound automation failed', {
          error: err.message,
          conversation: conversation.id,
        });
      }
    }
  } catch (err: any) {
    logger.error('Webhook processing error', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: 'internal_error', message: 'Webhook processing failed', code: 500 });
    }
  }
});

export default router;
