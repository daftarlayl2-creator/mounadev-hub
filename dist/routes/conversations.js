"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/conversations.ts
const express_1 = require("express");
const conversationService_1 = require("../services/conversationService");
const messageService_1 = require("../services/messageService");
const openwaAdapter_1 = require("../adapters/openwaAdapter");
const auditService_1 = require("../services/auditService");
const auth_1 = require("../middleware/auth");
const adapter = new openwaAdapter_1.OpenWAAdapter();
const msgService = (0, messageService_1.createMessageService)(adapter);
const router = (0, express_1.Router)();
router.use(auth_1.authenticateAgent);
router.get('/', async (req, res) => {
    try {
        const result = await conversationService_1.conversationService.list({
            contact_id: req.query.contact_id,
            status: req.query.status,
            assigned_agent: req.query.assigned_agent,
            limit: parseInt(req.query.limit) || 20,
            offset: parseInt(req.query.offset) || 0,
        });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const conv = await conversationService_1.conversationService.getById(req.params.id);
        if (!conv) {
            res.status(404).json({ error: 'conversation_not_found', message: 'Conversation not found', code: 404 });
            return;
        }
        const messages = await msgService.getConversationMessages(req.params.id);
        res.json({ ...conv, messages });
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
router.post('/', (0, auth_1.requirePermission)('write'), async (req, res) => {
    try {
        const agent = req.agent;
        const { contact_id, channel, assigned_agent } = req.body;
        if (!contact_id) {
            res.status(400).json({ error: 'validation_error', message: 'contact_id required', code: 400 });
            return;
        }
        const conv = await conversationService_1.conversationService.create(contact_id, channel || 'whatsapp', assigned_agent || agent.id);
        await auditService_1.auditService.log({ agentId: agent.id, action: 'create_conversation', resourceType: 'conversation', resourceId: conv.id, ipAddress: req.ip });
        res.status(201).json(conv);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
router.patch('/:id', (0, auth_1.requirePermission)('write'), async (req, res) => {
    try {
        const agent = req.agent;
        const conv = await conversationService_1.conversationService.update(req.params.id, req.body);
        await auditService_1.auditService.log({ agentId: agent.id, action: 'update_conversation', resourceType: 'conversation', resourceId: conv.id, details: req.body, ipAddress: req.ip });
        res.json(conv);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
router.post('/:id/close', (0, auth_1.requirePermission)('write'), async (req, res) => {
    try {
        const agent = req.agent;
        const conv = await conversationService_1.conversationService.close(req.params.id);
        await auditService_1.auditService.log({ agentId: agent.id, action: 'close_conversation', resourceType: 'conversation', resourceId: conv.id, ipAddress: req.ip });
        res.json(conv);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
router.post('/:id/escalate', (0, auth_1.requirePermission)('write'), async (req, res) => {
    try {
        const agent = req.agent;
        const conv = await conversationService_1.conversationService.escalate(req.params.id, req.body.agent_id || agent.id);
        await auditService_1.auditService.log({ agentId: agent.id, action: 'escalate_conversation', resourceType: 'conversation', resourceId: conv.id, ipAddress: req.ip });
        res.json(conv);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
exports.default = router;
//# sourceMappingURL=conversations.js.map