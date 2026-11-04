"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/templates.ts
const express_1 = require("express");
const supabase_1 = require("../utils/supabase");
const validation_1 = require("../utils/validation");
const auth_1 = require("../middleware/auth");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateAgent);
router.get('/', async (req, res) => {
    try {
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase.from('message_templates').select('*').order('created_at', { ascending: false });
        if (error)
            throw error;
        res.json({ data: data || [] });
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
router.post('/', (0, auth_1.requirePermission)('write'), async (req, res) => {
    try {
        const agent = req.agent;
        const parsed = validation_1.templateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'validation_error', message: parsed.error.message, code: 400 });
            return;
        }
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase.from('message_templates').insert(parsed.data).select().single();
        if (error)
            throw error;
        await auditService_1.auditService.log({ agentId: agent.id, action: 'create_template', resourceType: 'template', resourceId: data.id, ipAddress: req.ip });
        res.status(201).json(data);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
router.patch('/:id', (0, auth_1.requirePermission)('write'), async (req, res) => {
    try {
        const agent = req.agent;
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase.from('message_templates').update(req.body).eq('id', req.params.id).select().single();
        if (error)
            throw error;
        await auditService_1.auditService.log({ agentId: agent.id, action: 'update_template', resourceType: 'template', resourceId: data.id, ipAddress: req.ip });
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
router.post('/:id/submit', (0, auth_1.requirePermission)('write'), async (req, res) => {
    try {
        const agent = req.agent;
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase.from('message_templates').update({ status: 'pending' }).eq('id', req.params.id).select().single();
        if (error)
            throw error;
        await auditService_1.auditService.log({ agentId: agent.id, action: 'submit_template', resourceType: 'template', resourceId: data.id, ipAddress: req.ip });
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
exports.default = router;
//# sourceMappingURL=templates.js.map