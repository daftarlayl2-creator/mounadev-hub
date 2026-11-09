// src/services/contactService.ts
import { getSupabase } from '../utils/supabase';
import { logger } from '../utils/logger';
import { normalizePhone } from '../utils/validation';

export interface Contact {
  id: string;
  phone: string;
  name?: string;
  business_name?: string;
  business_type?: string;
  source: string;
  consent_status: string;
  consent_date?: string;
  opt_out_date?: string;
  assigned_agent?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export class ContactService {
  async search(params: { search?: string; business_type?: string; consent_status?: string; assigned_agent?: string; limit?: number; offset?: number }): Promise<{ data: Contact[]; total: number }> {
    const supabase = getSupabase();
    let query = supabase.from('contacts').select('*', { count: 'exact' });

    if (params.search) {
      const safeSearch = params.search.replace(/[^\p{L}\p{N}\s+@_-]/gu, ' ').trim().slice(0, 100);
      if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,business_name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`);
    }
    if (params.business_type) {
      query = query.eq('business_type', params.business_type);
    }
    if (params.consent_status) {
      query = query.eq('consent_status', params.consent_status);
    }
    if (params.assigned_agent) {
      query = query.eq('assigned_agent', params.assigned_agent);
    }

    const limit = Math.min(Math.max(params.limit || 20, 1), 100);
    const offset = Math.min(Math.max(params.offset || 0, 0), 100000);
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to search contacts: ${error.message}`);
    return { data: data || [], total: count || 0 };
  }

  async getById(id: string, assignedAgent?: string): Promise<Contact | null> {
    const supabase = getSupabase();
    let query = supabase.from('contacts').select('*').eq('id', id);
    if (assignedAgent) query = query.eq('assigned_agent', assignedAgent);
    const { data, error } = await query.single();
    if (error) return null;
    return data;
  }

  async getByPhone(phone: string): Promise<Contact | null> {
    const supabase = getSupabase();
    const normalized = normalizePhone(phone);
    const { data, error } = await supabase.from('contacts').select('*').eq('phone', normalized).single();
    if (error) return null;
    return data;
  }

  async create(contact: Partial<Contact>): Promise<Contact> {
    const supabase = getSupabase();
    const normalized = normalizePhone(contact.phone!);
    const { data, error } = await supabase
      .from('contacts')
      .insert({ ...contact, phone: normalized })
      .select()
      .single();
    if (error) throw new Error(`Failed to create contact: ${error.message}`);
    logger.info('Contact created', { id: data.id, phone: '***' + String(data.phone).slice(-4) });
    return data;
  }

  async update(id: string, updates: Partial<Contact>, assignedAgent?: string): Promise<Contact> {
    const supabase = getSupabase();
    let query = supabase
      .from('contacts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (assignedAgent) query = query.eq('assigned_agent', assignedAgent);
    const { data, error } = await query.select().single();
    if (error) throw new Error(`Failed to update contact: ${error.message}`);
    return data;
  }

  async optOut(id: string, reason: string, agentId: string, assignedAgent?: string): Promise<Contact> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('contacts')
      .update({
        consent_status: 'opted_out',
        opt_out_date: new Date().toISOString(),
        notes: `Opted out: ${reason}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    const scopedQuery = assignedAgent ? query.eq('assigned_agent', assignedAgent) : query;
    const { data, error } = await scopedQuery.select().single();
    if (error) throw new Error(`Failed to opt out contact: ${error.message}`);
    logger.info('Contact opted out', { id, agent: agentId });
    return data;
  }

  async checkPermission(id: string): Promise<{ allowed: boolean; reason?: string }> {
    const contact = await this.getById(id);
    if (!contact) return { allowed: false, reason: 'contact_not_found' };
    if (contact.consent_status === 'opted_out') return { allowed: false, reason: 'contact_opted_out' };
    if (contact.consent_status === 'none') return { allowed: false, reason: 'consent_required' };
    return { allowed: true };
  }
}

export const contactService = new ContactService();