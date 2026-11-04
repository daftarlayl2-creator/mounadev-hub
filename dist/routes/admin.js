"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/admin.ts
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const auditService_1 = require("../services/auditService");
const supabase_1 = require("../utils/supabase");
const logger_1 = require("../utils/logger");
const agentPersonas_1 = require("../services/agentPersonas");
const aiReplyService_1 = require("../services/aiReplyService");
const config_1 = require("../config");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateAgent);
// POST /admin/pause-outbound
router.post('/pause-outbound', (0, auth_1.requirePermission)('admin'), async (req, res) => {
    try {
        const agent = req.agent;
        const { reason, duration_minutes } = req.body;
        const supabase = (0, supabase_1.getSupabase)();
        // Store pause state in a simple key-value (use a settings table or env)
        // For now, log and return success
        await auditService_1.auditService.log({
            agentId: agent.id,
            action: 'pause_outbound',
            resourceType: 'system',
            details: { reason, duration_minutes },
            ipAddress: req.ip,
        });
        logger_1.logger.warn('Outbound messaging paused', { agent: agent.id, reason, duration_minutes });
        res.json({ paused: true, reason, duration_minutes, paused_by: agent.id });
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
// POST /admin/resume-outbound
router.post('/resume-outbound', (0, auth_1.requirePermission)('admin'), async (req, res) => {
    try {
        const agent = req.agent;
        await auditService_1.auditService.log({ agentId: agent.id, action: 'resume_outbound', resourceType: 'system', ipAddress: req.ip });
        logger_1.logger.info('Outbound messaging resumed', { agent: agent.id });
        res.json({ paused: false, resumed_by: agent.id });
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
// GET /admin/status
router.get('/status', async (req, res) => {
    try {
        const supabase = (0, supabase_1.getSupabase)();
        const { count: totalMessages } = await supabase.from('messages').select('*', { count: 'exact', head: true });
        const { count: totalContacts } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
        const { count: activeConversations } = await supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'active');
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            stats: {
                total_messages: totalMessages || 0,
                total_contacts: totalContacts || 0,
                active_conversations: activeConversations || 0,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
// GET /admin/agents — list employee agents available to back the WhatsApp agent
router.get('/agents', async (_req, res) => {
    res.json({ agents: (0, agentPersonas_1.listPersonas)() });
});
// POST /admin/test-reply — generate a test AI reply without sending
router.post('/test-reply', (0, auth_1.requirePermission)('admin'), async (req, res) => {
    try {
        const { agent_id, message, contact_name, business_name } = req.body;
        const result = await aiReplyService_1.aiReplyService.generateReply({
            agentId: agent_id || config_1.config.whatsappAgent.agentId,
            customerMessage: message || 'Bonjour',
            contactName: contact_name,
            businessName: business_name,
        });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map