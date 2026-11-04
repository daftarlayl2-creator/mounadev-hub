"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateService = exports.TemplateService = void 0;
// src/services/templateService.ts
const supabase_1 = require("../utils/supabase");
const logger_1 = require("../utils/logger");
class TemplateService {
    async list() {
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase.from('message_templates').select('*').order('created_at', { ascending: false });
        if (error)
            throw new Error(`Failed to list templates: ${error.message}`);
        return data || [];
    }
    async getByName(name) {
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase.from('message_templates').select('*').eq('name', name).single();
        if (error)
            return null;
        return data;
    }
    async create(template) {
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase.from('message_templates').insert(template).select().single();
        if (error)
            throw new Error(`Failed to create template: ${error.message}`);
        logger_1.logger.info('Template created', { name: template.name });
        return data;
    }
    async update(id, updates) {
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase.from('message_templates').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
        if (error)
            throw new Error(`Failed to update template: ${error.message}`);
        return data;
    }
    async submit(id) {
        return this.update(id, { status: 'pending' });
    }
    async approve(id, providerTemplateId) {
        return this.update(id, { status: 'approved', provider_template_id: providerTemplateId });
    }
    async reject(id) {
        return this.update(id, { status: 'rejected' });
    }
    validateVariables(template, variables) {
        const missing = [];
        for (const v of template.variables) {
            if (!variables[v])
                missing.push(v);
        }
        return { valid: missing.length === 0, missing };
    }
    render(template, variables) {
        let content = template.content;
        for (const [key, value] of Object.entries(variables)) {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        return content;
    }
}
exports.TemplateService = TemplateService;
exports.templateService = new TemplateService();
//# sourceMappingURL=templateService.js.map