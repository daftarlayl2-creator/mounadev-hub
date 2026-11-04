"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/contacts.ts
const express_1 = require("express");
const contactService_1 = require("../services/contactService");
const auditService_1 = require("../services/auditService");
const validation_1 = require("../utils/validation");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateAgent);
// GET /contacts
router.get('/', async (req, res) => {
    try {
        const agent = req.agent;
        const result = await contactService_1.contactService.search({
            search: req.query.search,
            business_type: req.query.business_type,
            consent_status: req.query.consent_status,
            assigned_agent: req.query.assigned_agent,
            limit: parseInt(req.query.limit) || 20,
            offset: parseInt(req.query.offset) || 0,
        });
        res.json(result);
    }
    catch (err) {
        logger_1.logger.error('Failed to search contacts', { error: err.message });
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
// GET /contacts/:id
router.get('/:id', async (req, res) => {
    try {
        const contact = await contactService_1.contactService.getById(req.params.id);
        if (!contact) {
            res.status(404).json({ error: 'contact_not_found', message: 'Contact not found', code: 404 });
            return;
        }
        res.json(contact);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
// POST /contacts
router.post('/', (0, auth_1.requirePermission)('write'), async (req, res) => {
    try {
        const agent = req.agent;
        const parsed = validation_1.contactSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'validation_error', message: parsed.error.message, code: 400 });
            return;
        }
        const contact = await contactService_1.contactService.create(parsed.data);
        await auditService_1.auditService.log({ agentId: agent.id, action: 'create_contact', resourceType: 'contact', resourceId: contact.id, ipAddress: req.ip });
        res.status(201).json(contact);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
// PATCH /contacts/:id
router.patch('/:id', (0, auth_1.requirePermission)('write'), async (req, res) => {
    try {
        const agent = req.agent;
        const contact = await contactService_1.contactService.update(req.params.id, req.body);
        await auditService_1.auditService.log({ agentId: agent.id, action: 'update_contact', resourceType: 'contact', resourceId: contact.id, ipAddress: req.ip });
        res.json(contact);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
// POST /contacts/:id/opt-out
router.post('/:id/opt-out', (0, auth_1.requirePermission)('write'), async (req, res) => {
    try {
        const agent = req.agent;
        const contact = await contactService_1.contactService.optOut(req.params.id, req.body.reason || 'agent_request', agent.id);
        await auditService_1.auditService.log({ agentId: agent.id, action: 'mark_opt_out', resourceType: 'contact', resourceId: contact.id, details: { reason: req.body.reason }, ipAddress: req.ip });
        res.json(contact);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
// GET /contacts/:id/permission
router.get('/:id/permission', async (req, res) => {
    try {
        const perm = await contactService_1.contactService.checkPermission(req.params.id);
        res.json(perm);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
exports.default = router;
//# sourceMappingURL=contacts.js.map