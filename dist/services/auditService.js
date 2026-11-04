"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = exports.AuditService = void 0;
// src/services/auditService.ts
const supabase_1 = require("../utils/supabase");
const logger_1 = require("../utils/logger");
class AuditService {
    async log(params) {
        const supabase = (0, supabase_1.getSupabase)();
        const { error } = await supabase.from('audit_log').insert({
            agent_id: params.agentId,
            action: params.action,
            resource_type: params.resourceType,
            resource_id: params.resourceId,
            details: params.details,
            ip_address: params.ipAddress,
        });
        if (error) {
            logger_1.logger.error('Failed to write audit log', { error: error.message });
        }
    }
    async query(params) {
        const supabase = (0, supabase_1.getSupabase)();
        let query = supabase.from('audit_log').select('*', { count: 'exact' });
        if (params.agent_id)
            query = query.eq('agent_id', params.agent_id);
        if (params.action)
            query = query.eq('action', params.action);
        if (params.resource_type)
            query = query.eq('resource_type', params.resource_type);
        if (params.from_date)
            query = query.gte('created_at', params.from_date);
        if (params.to_date)
            query = query.lte('created_at', params.to_date);
        const limit = params.limit || 50;
        const offset = params.offset || 0;
        query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });
        const { data, error, count } = await query;
        if (error)
            throw new Error(`Failed to query audit log: ${error.message}`);
        return { data: data || [], total: count || 0 };
    }
}
exports.AuditService = AuditService;
exports.auditService = new AuditService();
//# sourceMappingURL=auditService.js.map