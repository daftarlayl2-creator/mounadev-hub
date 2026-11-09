// src/middleware/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../utils/supabase';
import { config } from '../config';
import { logger } from '../utils/logger';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  reason?: string;
}

async function checkRateLimit(agentId: string, contactId?: string): Promise<RateLimitResult> {
  const supabase = getSupabase();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Check global hourly
  const { count: globalHourly, error: globalHourlyError } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo.toISOString());
  if ((globalHourly || 0) >= config.rateLimits.globalHourly) {
    return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 60 * 60 * 1000), reason: 'global_hourly' };
  }

  if (globalHourlyError) throw new Error('Global hourly rate-limit query failed');

  // Check global daily
  const { count: globalDaily, error: globalDailyError } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneDayAgo.toISOString());
  if ((globalDaily || 0) >= config.rateLimits.globalDaily) {
    return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), reason: 'global_daily' };
  }

  if (globalDailyError) throw new Error('Global daily rate-limit query failed');

  // Check agent hourly
  const { count: agentHourly, error: agentHourlyError } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', agentId)
    .eq('direction', 'outbound')
    .gte('created_at', oneHourAgo.toISOString());
  if ((agentHourly || 0) >= config.rateLimits.agentHourly) {
    return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 60 * 60 * 1000), reason: 'agent_hourly' };
  }

  if (agentHourlyError) throw new Error('Agent hourly rate-limit query failed');

  // Check agent daily
  const { count: agentDaily, error: agentDailyError } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', agentId)
    .eq('direction', 'outbound')
    .gte('created_at', oneDayAgo.toISOString());
  if ((agentDaily || 0) >= config.rateLimits.agentDaily) {
    return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), reason: 'agent_daily' };
  }

  if (agentDailyError) throw new Error('Agent daily rate-limit query failed');

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

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const agent = (req as any).agent;
  if (!agent) {
    next();
    return;
  }

  const contactId = req.body?.contact_id;

  checkRateLimit(agent.id, contactId)
    .then(result => {
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
      res.status(503).json({
        error: 'rate_limit_unavailable',
        message: 'Unable to verify sending limits; retry later',
        code: 503,
      });
    });
}