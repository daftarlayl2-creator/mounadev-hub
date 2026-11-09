// src/middleware/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../utils/supabase';
import { config } from '../config';
import { logger } from '../utils/logger';
import { contactService } from '../services/contactService';
import { AuthenticatedRequest } from './auth';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  reason?: string;
}

export async function checkRateLimit(agentId: string, contactId?: string): Promise<RateLimitResult> {
  const supabase = getSupabase();
  await assertOutboundNotPaused(supabase);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Check global hourly
  const { count: globalHourly, error: globalHourlyError } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .gte('created_at', oneHourAgo.toISOString());
  if (globalHourlyError) throw new Error('Global hourly rate-limit query failed');
  if ((globalHourly || 0) >= config.rateLimits.globalHourly) {
    return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 60 * 60 * 1000), reason: 'global_hourly' };
  }


  // Check global daily
  const { count: globalDaily, error: globalDailyError } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .gte('created_at', oneDayAgo.toISOString());
  if (globalDailyError) throw new Error('Global daily rate-limit query failed');
  if ((globalDaily || 0) >= config.rateLimits.globalDaily) {
    return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), reason: 'global_daily' };
  }


  // Check agent hourly
  const { count: agentHourly, error: agentHourlyError } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', agentId)
    .eq('direction', 'outbound')
    .gte('created_at', oneHourAgo.toISOString());
  if (agentHourlyError) throw new Error('Agent hourly rate-limit query failed');
  if ((agentHourly || 0) >= config.rateLimits.agentHourly) {
    return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 60 * 60 * 1000), reason: 'agent_hourly' };
  }


  // Check agent daily
  const { count: agentDaily, error: agentDailyError } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', agentId)
    .eq('direction', 'outbound')
    .gte('created_at', oneDayAgo.toISOString());
  if (agentDailyError) throw new Error('Agent daily rate-limit query failed');
  if ((agentDaily || 0) >= config.rateLimits.agentDaily) {
    return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), reason: 'agent_daily' };
  }


  // Resolve a contact's conversations first; messages reference conversation_id, not contact_id.
  if (contactId) {
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId);
    if (conversationsError) throw new Error('Contact conversation lookup failed');

    const conversationIds = (conversations || []).map((conversation: { id: string }) => conversation.id);
    if (conversationIds.length > 0) {
      const { count: contactHourly, error: contactHourlyError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .eq('direction', 'outbound')
        .gte('created_at', oneHourAgo.toISOString());
      if (contactHourlyError) throw new Error('Contact hourly rate-limit query failed');
      if ((contactHourly || 0) >= config.rateLimits.contactHourly) {
        return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 60 * 60 * 1000), reason: 'contact_hourly' };
      }

      const { count: contactDaily, error: contactDailyError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .eq('direction', 'outbound')
        .gte('created_at', oneDayAgo.toISOString());
      if (contactDailyError) throw new Error('Contact daily rate-limit query failed');
      if ((contactDaily || 0) >= config.rateLimits.contactDaily) {
        return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), reason: 'contact_daily' };
      }
    }
  }

  const remaining = config.rateLimits.agentDaily - (agentDaily || 0);
  return { allowed: true, remaining, resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) };
}

async function assertOutboundNotPaused(supabase: ReturnType<typeof getSupabase>): Promise<void> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('action, details, created_at')
    .in('action', ['pause_outbound', 'resume_outbound'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('Unable to verify emergency-stop state');
  if (!data || data.action !== 'pause_outbound') return;

  const duration = Number(data.details?.duration_minutes);
  const durationMs = Number.isFinite(duration) && duration > 0 ? duration * 60 * 1000 : 60 * 60 * 1000;
  const expiresAt = new Date(data.created_at).getTime() + durationMs;
  if (Date.now() < expiresAt) throw new Error('outbound_paused');
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const agent = (req as any).agent;
  if (!agent) {
    res.status(401).json({ error: 'agent_not_authenticated', message: 'Authentication required', code: 401 });
    return;
  }

  const contactId = req.body?.contact_id;

  // Do not evaluate contact-specific limits until ownership is established.
  // Otherwise an authenticated agent could probe another agent's contact IDs
  // and infer their outbound activity from rate-limit responses.
  const assignedAgentScope = agent.permissions?.includes('admin') ? undefined : agent.id;
  const authorizeContact = typeof contactId === 'string'
    ? contactService.getById(contactId, assignedAgentScope)
    : Promise.resolve(null);

  authorizeContact
    .then(contact => {
      if (typeof contactId === 'string' && !contact) {
        res.status(404).json({ error: 'contact_not_found', message: 'Contact not found', code: 404 });
        return null;
      }
      return checkRateLimit(agent.id, typeof contactId === 'string' ? contactId : undefined);
    })
    .then(result => {
      if (!result) return;
      if (!result.allowed) {
        logger.warn('Rate limit exceeded', { agent: agent.id, reason: result.reason });
        res.status(429).json({
          error: 'rate_limit_exceeded',
          message: `Rate limit exceeded: ${result.reason}`,
          code: 429,
          retry_after: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
        });
        return;
      }
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      next();
    })
    .catch(err => {
      logger.error('Rate limit check failed; outbound request blocked', { error: err });
      if (err instanceof Error && err.message === 'outbound_paused') {
        res.status(423).json({ error: 'outbound_paused', message: 'Outbound messaging is temporarily paused', code: 423 });
        return;
      }
      res.status(503).json({
        error: 'rate_limit_unavailable',
        message: 'Unable to verify sending limits; retry later',
        code: 503,
      });
    });
}