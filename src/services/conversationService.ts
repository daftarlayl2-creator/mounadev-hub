// src/services/conversationService.ts
import { getSupabase } from '../utils/supabase';
import { logger } from '../utils/logger';

export interface Conversation {
  id: string;
  contact_id: string;
  channel: string;
  status: string;
  assigned_agent?: string;
  last_message_at?: string;
  window_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export class ConversationService {
  async list(params: { contact_id?: string; status?: string; assigned_agent?: string; limit?: number; offset?: number }): Promise<{ data: any[]; total: number }> {
    const supabase = getSupabase();
    let query = supabase.from('conversations').select('*, contacts(phone, name, business_name)', { count: 'exact' });

    if (params.contact_id) query = query.eq('contact_id', params.contact_id);
    if (params.status) query = query.eq('status', params.status);
    if (params.assigned_agent) query = query.eq('assigned_agent', params.assigned_agent);

    const limit = params.limit || 20;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1).order('updated_at', { ascending: false });

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list conversations: ${error.message}`);
    return { data: data || [], total: count || 0 };
  }

  async getById(id: string, assignedAgent?: string): Promise<any | null> {
    const supabase = getSupabase();
    let query = supabase
      .from('conversations')
      .select('*, contacts(phone, name, business_name, business_type)')
      .eq('id', id);
    if (assignedAgent) query = query.eq('assigned_agent', assignedAgent);
    const { data, error } = await query.single();
    if (error) return null;
    return data;
  }

  async getByContact(contactId: string): Promise<any | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('contact_id', contactId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) return null;
    return data;
  }

  async create(contactId: string, channel: string = 'whatsapp', assignedAgent?: string): Promise<Conversation> {
    const supabase = getSupabase();
    const windowExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        contact_id: contactId,
        channel,
        status: 'active',
        assigned_agent: assignedAgent,
        last_message_at: new Date().toISOString(),
        window_expires_at: windowExpires,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to create conversation: ${error.message}`);
    logger.info('Conversation created', { id: data.id, contact: contactId });
    return data;
  }

  async update(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('conversations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update conversation: ${error.message}`);
    return data;
  }

  async close(id: string): Promise<Conversation> {
    return this.update(id, { status: 'closed' });
  }

  async escalate(id: string, agentId: string): Promise<Conversation> {
    return this.update(id, { status: 'escalated', assigned_agent: agentId });
  }

  async isWindowExpired(id: string): Promise<boolean> {
    const conv = await this.getById(id);
    if (!conv || !conv.window_expires_at) return true;
    return new Date(conv.window_expires_at) < new Date();
  }
}

export const conversationService = new ConversationService();