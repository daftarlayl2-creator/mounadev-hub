export interface AuditEntry {
    id: string;
    agent_id: string;
    action: string;
    resource_type?: string;
    resource_id?: string;
    details?: Record<string, any>;
    ip_address?: string;
    created_at: string;
}
export declare class AuditService {
    log(params: {
        agentId: string;
        action: string;
        resourceType?: string;
        resourceId?: string;
        details?: Record<string, any>;
        ipAddress?: string;
    }): Promise<void>;
    query(params: {
        agent_id?: string;
        action?: string;
        resource_type?: string;
        from_date?: string;
        to_date?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: AuditEntry[];
        total: number;
    }>;
}
export declare const auditService: AuditService;
