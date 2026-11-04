"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = rateLimitMiddleware;
const supabase_1 = require("../utils/supabase");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
async function checkRateLimit(agentId, contactId) {
    const supabase = (0, supabase_1.getSupabase)();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // Check global hourly
    const { count: globalHourly } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo.toISOString());
    if ((globalHourly || 0) >= config_1.config.rateLimits.globalHourly) {
        return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 60 * 60 * 1000), reason: 'global_hourly' };
    }
    // Check global daily
    const { count: globalDaily } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneDayAgo.toISOString());
    if ((globalDaily || 0) >= config_1.config.rateLimits.globalDaily) {
        return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), reason: 'global_daily' };
    }
    // Check agent hourly
    const { count: agentHourly } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', agentId)
        .eq('direction', 'outbound')
        .gte('created_at', oneHourAgo.toISOString());
    if ((agentHourly || 0) >= config_1.config.rateLimits.agentHourly) {
        return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 60 * 60 * 1000), reason: 'agent_hourly' };
    }
    // Check agent daily
    const { count: agentDaily } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', agentId)
        .eq('direction', 'outbound')
        .gte('created_at', oneDayAgo.toISOString());
    if ((agentDaily || 0) >= config_1.config.rateLimits.agentDaily) {
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
        if ((contactDaily || 0) >= config_1.config.rateLimits.contactDaily) {
            return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), reason: 'contact_daily' };
        }
    }
    const remaining = config_1.config.rateLimits.agentDaily - (agentDaily || 0);
    return { allowed: true, remaining, resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) };
}
function rateLimitMiddleware(req, res, next) {
    const agent = req.agent;
    if (!agent) {
        next();
        return;
    }
    const contactId = req.body?.contact_id;
    checkRateLimit(agent.id, contactId)
        .then(result => {
        if (!result.allowed) {
            logger_1.logger.warn('Rate limit exceeded', { agent: agent.id, reason: result.reason });
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
        logger_1.logger.error('Rate limit check failed', { error: err });
        next(); // Fail open
    });
}
//# sourceMappingURL=rateLimiter.js.map