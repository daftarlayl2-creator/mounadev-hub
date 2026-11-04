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
  const { count: globalHourly } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo.toISOString());
  if ((globalHourly || 0) >= config.rateLimits.globalHourly) {
    return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 60 * 60 * 1000), reason: 'global_hourly' };
  }

  // Check global daily
  const { count: globalDaily } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneDayAgo.toISOString());
  if ((globalDaily || 0) >= config.rateLimits.globalDaily) {
    return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), reason: 'global_daily' };
  }

  // Check agent hourly
  const { count: agentHourly } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', agentId)
    .eq('direction', 'outbound')
    .gte('created_at', oneHourAgo.toISOString());
  if ((agentHourly || 0) >= config.rateLimits.agentHourly) {
    return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 60 * 60 * 1000), reason: 'agent_hourly' };
  }

  // Check agent daily
  const { count: agentDaily } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', agentId)
    .eq('direction', 'outbound')
    .gte('created_at', oneDayAgo.toISOString());
  if ((agentDaily || 0) >= config.rateLimits.agentDaily) {
    return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), reason: 'agent_daily' };
  }

  // Check contact daily (if contact specified)
  if (contactId) {
    const { count: contactDaily } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', contactId) // simplified: use conversation_id as proxy
      .eq('direction', 'outbound')
      .gte('created_at', oneDayAgo.toISOString());
    if ((contactDaily || 0) >= config.rateLimits.contactDaily) {
      return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), reason: 'contact_daily' };
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
      logger.error('Rate limit check failed', { error: err });
      next(); // Fail open
    });
}