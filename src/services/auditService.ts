// src/services/auditService.ts
import { getSupabase } from '../utils/supabase';
import { logger } from '../utils/logger';

export interface AuditEntry {
  id: string;
  agent_id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export class AuditService {
  async log(params: {
    agentId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
  }): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('audit_log').insert({
      agent_id: params.agentId,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      details: params.details,
      ip_address: params.ipAddress,
    });
    if (error) {
      logger.error('Failed to write audit log', { error: error.message });
    }
  }

  async query(params: {
    agent_id?: string;
    action?: string;
    resource_type?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AuditEntry[]; total: number }> {
    const supabase = getSupabase();
    let query = supabase.from('audit_log').select('*', { count: 'exact' });

    if (params.agent_id) query = query.eq('agent_id', params.agent_id);
    if (params.action) query = query.eq('action', params.action);
    if (params.resource_type) query = query.eq('resource_type', params.resource_type);
    if (params.from_date) query = query.gte('created_at', params.from_date);
    if (params.to_date) query = query.lte('created_at', params.to_date);

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to query audit log: ${error.message}`);
    return { data: data || [], total: count || 0 };
  }
}

export const auditService = new AuditService();