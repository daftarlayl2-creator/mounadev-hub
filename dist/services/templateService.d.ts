export interface MessageTemplate {
    id: string;
    name: string;
    language: string;
    category: string;
    content: string;
    variables: string[];
    status: string;
    provider_template_id?: string;
    created_at: string;
    updated_at: string;
}
export declare class TemplateService {
    list(): Promise<MessageTemplate[]>;
    getByName(name: string): Promise<MessageTemplate | null>;
    create(template: Partial<MessageTemplate>): Promise<MessageTemplate>;
    update(id: string, updates: Partial<MessageTemplate>): Promise<MessageTemplate>;
    submit(id: string): Promise<MessageTemplate>;
    approve(id: string, providerTemplateId?: string): Promise<MessageTemplate>;
    reject(id: string): Promise<MessageTemplate>;
    validateVariables(template: MessageTemplate, variables: Record<string, string>): {
        valid: boolean;
        missing: string[];
    };
    render(template: MessageTemplate, variables: Record<string, string>): string;
}
export declare const templateService: TemplateService;
