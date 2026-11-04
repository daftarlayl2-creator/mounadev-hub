export interface Conversation {
    id: string;
    contact_id: string;
    channel: string;
    status: string;
    assigned_agent?: string;
    last_message_at?: string;
    window_expires_at?: string;
    created_at: string;
    updated_at: string;
}
export declare class ConversationService {
    list(params: {
        contact_id?: string;
        status?: string;
        assigned_agent?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: any[];
        total: number;
    }>;
    getById(id: string): Promise<any | null>;
    getByContact(contactId: string): Promise<any | null>;
    create(contactId: string, channel?: string, assignedAgent?: string): Promise<Conversation>;
    update(id: string, updates: Partial<Conversation>): Promise<Conversation>;
    close(id: string): Promise<Conversation>;
    escalate(id: string, agentId: string): Promise<Conversation>;
    isWindowExpired(id: string): Promise<boolean>;
}
export declare const conversationService: ConversationService;
