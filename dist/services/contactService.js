"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactService = exports.ContactService = void 0;
// src/services/contactService.ts
const supabase_1 = require("../utils/supabase");
const logger_1 = require("../utils/logger");
const validation_1 = require("../utils/validation");
class ContactService {
    async search(params) {
        const supabase = (0, supabase_1.getSupabase)();
        let query = supabase.from('contacts').select('*', { count: 'exact' });
        if (params.search) {
            query = query.or(`name.ilike.%${params.search}%,business_name.ilike.%${params.search}%,phone.ilike.%${params.search}%`);
        }
        if (params.business_type) {
            query = query.eq('business_type', params.business_type);
        }
        if (params.consent_status) {
            query = query.eq('consent_status', params.consent_status);
        }
        if (params.assigned_agent) {
            query = query.eq('assigned_agent', params.assigned_agent);
        }
        const limit = params.limit || 20;
        const offset = params.offset || 0;
        query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });
        const { data, error, count } = await query;
        if (error)
            throw new Error(`Failed to search contacts: ${error.message}`);
        return { data: data || [], total: count || 0 };
    }
    async getById(id) {
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase.from('contacts').select('*').eq('id', id).single();
        if (error)
            return null;
        return data;
    }
    async getByPhone(phone) {
        const supabase = (0, supabase_1.getSupabase)();
        const normalized = (0, validation_1.normalizePhone)(phone);
        const { data, error } = await supabase.from('contacts').select('*').eq('phone', normalized).single();
        if (error)
            return null;
        return data;
    }
    async create(contact) {
        const supabase = (0, supabase_1.getSupabase)();
        const normalized = (0, validation_1.normalizePhone)(contact.phone);
        const { data, error } = await supabase
            .from('contacts')
            .insert({ ...contact, phone: normalized })
            .select()
            .single();
        if (error)
            throw new Error(`Failed to create contact: ${error.message}`);
        logger_1.logger.info('Contact created', { id: data.id, phone: data.phone });
        return data;
    }
    async update(id, updates) {
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase
            .from('contacts')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw new Error(`Failed to update contact: ${error.message}`);
        return data;
    }
    async optOut(id, reason, agentId) {
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase
            .from('contacts')
            .update({
            consent_status: 'opted_out',
            opt_out_date: new Date().toISOString(),
            notes: `Opted out: ${reason}`,
            updated_at: new Date().toISOString(),
        })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw new Error(`Failed to opt out contact: ${error.message}`);
        logger_1.logger.info('Contact opted out', { id, reason, agent: agentId });
        return data;
    }
    async checkPermission(id) {
        const contact = await this.getById(id);
        if (!contact)
            return { allowed: false, reason: 'contact_not_found' };
        if (contact.consent_status === 'opted_out')
            return { allowed: false, reason: 'contact_opted_out' };
        if (contact.consent_status === 'none')
            return { allowed: false, reason: 'consent_required' };
        return { allowed: true };
    }
}
exports.ContactService = ContactService;
exports.contactService = new ContactService();
//# sourceMappingURL=contactService.js.map