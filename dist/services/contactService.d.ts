export interface Contact {
    id: string;
    phone: string;
    name?: string;
    business_name?: string;
    business_type?: string;
    source: string;
    consent_status: string;
    consent_date?: string;
    opt_out_date?: string;
    assigned_agent?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}
export declare class ContactService {
    search(params: {
        search?: string;
        business_type?: string;
        consent_status?: string;
        assigned_agent?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: Contact[];
        total: number;
    }>;
    getById(id: string): Promise<Contact | null>;
    getByPhone(phone: string): Promise<Contact | null>;
    create(contact: Partial<Contact>): Promise<Contact>;
    update(id: string, updates: Partial<Contact>): Promise<Contact>;
    optOut(id: string, reason: string, agentId: string): Promise<Contact>;
    checkPermission(id: string): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
}
export declare const contactService: ContactService;
