"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/messages.ts
const express_1 = require("express");
const messageService_1 = require("../services/messageService");
const openwaAdapter_1 = require("../adapters/openwaAdapter");
const auditService_1 = require("../services/auditService");
const validation_1 = require("../utils/validation");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const logger_1 = require("../utils/logger");
const adapter = new openwaAdapter_1.OpenWAAdapter();
const msgService = (0, messageService_1.createMessageService)(adapter);
const router = (0, express_1.Router)();
router.use(auth_1.authenticateAgent);
// POST /messages/send
router.post('/send', (0, auth_1.requirePermission)('send'), rateLimiter_1.rateLimitMiddleware, async (req, res) => {
    try {
        const agent = req.agent;
        const parsed = validation_1.messageSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'validation_error', message: parsed.error.message, code: 400 });
            return;
        }
        const { contact_id, content, message_type, idempotency_key, template_name } = parsed.data;
        const message = await msgService.send({
            contactId: contact_id,
            content,
            messageType: message_type,
            idempotencyKey: idempotency_key,
            templateName: template_name,
            agentId: agent.id,
        });
        await auditService_1.auditService.log({
            agentId: agent.id,
            action: 'send_message',
            resourceType: 'message',
            resourceId: message.id,
            details: { contact_id, message_type, content_length: content.length },
            ipAddress: req.ip,
        });
        res.status(201).json(message);
    }
    catch (err) {
        logger_1.logger.error('Failed to send message', { error: err.message });
        const errorMap = {
            'contact_not_found': { status: 404, code: 'contact_not_found' },
            'contact_opted_out': { status: 403, code: 'contact_opted_out' },
            'consent_required': { status: 403, code: 'consent_required' },
        };
        const mapped = errorMap[err.message];
        if (mapped) {
            res.status(mapped.status).json({ error: mapped.code, message: err.message, code: mapped.status });
            return;
        }
        if (err.message.startsWith('provider_error')) {
            res.status(502).json({ error: 'provider_error', message: err.message, code: 502 });
            return;
        }
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
// POST /messages/send-template
router.post('/send-template', (0, auth_1.requirePermission)('send'), rateLimiter_1.rateLimitMiddleware, async (req, res) => {
    try {
        const agent = req.agent;
        const { contact_id, template_name, variables, idempotency_key } = req.body;
        if (!contact_id || !template_name) {
            res.status(400).json({ error: 'validation_error', message: 'contact_id and template_name required', code: 400 });
            return;
        }
        const message = await msgService.send({
            contactId: contact_id,
            content: `Template: ${template_name}`,
            messageType: 'template',
            idempotencyKey: idempotency_key,
            templateName: template_name,
            variables,
            agentId: agent.id,
        });
        await auditService_1.auditService.log({
            agentId: agent.id,
            action: 'send_template',
            resourceType: 'message',
            resourceId: message.id,
            details: { contact_id, template_name },
            ipAddress: req.ip,
        });
        res.status(201).json(message);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
// GET /messages/:id/status
router.get('/:id/status', async (req, res) => {
    try {
        const supabase = (await Promise.resolve().then(() => __importStar(require('../utils/supabase')))).getSupabase();
        const { data, error } = await supabase.from('messages').select('id, status, provider_message_id, updated_at').eq('id', req.params.id).single();
        if (error || !data) {
            res.status(404).json({ error: 'message_not_found', message: 'Message not found', code: 404 });
            return;
        }
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
// GET /messages/conversation/:conversationId
router.get('/conversation/:conversationId', async (req, res) => {
    try {
        const messages = await msgService.getConversationMessages(req.params.conversationId);
        res.json({ data: messages });
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
exports.default = router;
//# sourceMappingURL=messages.js.map