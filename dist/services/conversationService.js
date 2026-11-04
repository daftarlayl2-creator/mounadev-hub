"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationService = exports.ConversationService = void 0;
// src/services/conversationService.ts
const supabase_1 = require("../utils/supabase");
const logger_1 = require("../utils/logger");
class ConversationService {
    async list(params) {
        const supabase = (0, supabase_1.getSupabase)();
        let query = supabase.from('conversations').select('*, contacts(phone, name, business_name)', { count: 'exact' });
        if (params.contact_id)
            query = query.eq('contact_id', params.contact_id);
        if (params.status)
            query = query.eq('status', params.status);
        if (params.assigned_agent)
            query = query.eq('assigned_agent', params.assigned_agent);
        const limit = params.limit || 20;
        const offset = params.offset || 0;
        query = query.range(offset, offset + limit - 1).order('updated_at', { ascending: false });
        const { data, error, count } = await query;
        if (error)
            throw new Error(`Failed to list conversations: ${error.message}`);
        return { data: data || [], total: count || 0 };
    }
    async getById(id) {
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase
            .from('conversations')
            .select('*, contacts(phone, name, business_name, business_type)')
            .eq('id', id)
            .single();
        if (error)
            return null;
        return data;
    }
    async getByContact(contactId) {
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('contact_id', contactId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        if (error)
            return null;
        return data;
    }
    async create(contactId, channel = 'whatsapp', assignedAgent) {
        const supabase = (0, supabase_1.getSupabase)();
        const windowExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('conversations')
            .insert({
            contact_id: contactId,
            channel,
            status: 'active',
            assigned_agent: assignedAgent,
            last_message_at: new Date().toISOString(),
            window_expires_at: windowExpires,
        })
            .select()
            .single();
        if (error)
            throw new Error(`Failed to create conversation: ${error.message}`);
        logger_1.logger.info('Conversation created', { id: data.id, contact: contactId });
        return data;
    }
    async update(id, updates) {
        const supabase = (0, supabase_1.getSupabase)();
        const { data, error } = await supabase
            .from('conversations')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw new Error(`Failed to update conversation: ${error.message}`);
        return data;
    }
    async close(id) {
        return this.update(id, { status: 'closed' });
    }
    async escalate(id, agentId) {
        return this.update(id, { status: 'escalated', assigned_agent: agentId });
    }
    async isWindowExpired(id) {
        const conv = await this.getById(id);
        if (!conv || !conv.window_expires_at)
            return true;
        return new Date(conv.window_expires_at) < new Date();
    }
}
exports.ConversationService = ConversationService;
exports.conversationService = new ConversationService();
//# sourceMappingURL=conversationService.js.map