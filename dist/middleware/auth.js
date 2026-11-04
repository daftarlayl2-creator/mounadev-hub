"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateAgent = authenticateAgent;
exports.requirePermission = requirePermission;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const supabase_1 = require("../utils/supabase");
const logger_1 = require("../utils/logger");
async function authenticateAgent(req, res, next) {
    const apiKey = req.headers['x-agent-key'];
    if (!apiKey) {
        res.status(401).json({ error: 'agent_not_found', message: 'Missing X-Agent-Key header', code: 401 });
        return;
    }
    try {
        const supabase = (0, supabase_1.getSupabase)();
        const { data: agents, error } = await supabase
            .from('agents')
            .select('id, name, role, api_key_hash, permissions');
        if (error || !agents) {
            logger_1.logger.error('Failed to fetch agents', { error });
            res.status(500).json({ error: 'internal_error', message: 'Authentication service unavailable', code: 500 });
            return;
        }
        // Find matching agent by comparing hashed key
        let matchedAgent = null;
        for (const agent of agents) {
            if (agent.api_key_hash && await bcryptjs_1.default.compare(apiKey, agent.api_key_hash)) {
                matchedAgent = agent;
                break;
            }
        }
        if (!matchedAgent) {
            logger_1.logger.warn('Authentication failed', { ip: req.ip });
            res.status(401).json({ error: 'agent_not_found', message: 'Invalid agent API key', code: 401 });
            return;
        }
        req.agent = {
            id: matchedAgent.id,
            name: matchedAgent.name,
            role: matchedAgent.role,
            permissions: matchedAgent.permissions || [],
        };
        next();
    }
    catch (err) {
        logger_1.logger.error('Authentication error', { error: err });
        res.status(500).json({ error: 'internal_error', message: 'Authentication failed', code: 500 });
    }
}
function requirePermission(permission) {
    return (req, res, next) => {
        const agent = req.agent;
        if (!agent || !agent.permissions.includes(permission)) {
            res.status(403).json({
                error: 'agent_not_permitted',
                message: `Agent lacks '${permission}' permission`,
                code: 403,
            });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map