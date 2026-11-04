export interface AiReplyResult {
    success: boolean;
    reply: string;
    error?: string;
}
export declare class AiReplyService {
    private apiUrl;
    private apiKey;
    private model;
    constructor();
    generateReply(params: {
        agentId: string;
        customerMessage: string;
        conversationHistory?: {
            role: 'user' | 'assistant';
            content: string;
        }[];
        contactName?: string;
        businessName?: string;
    }): Promise<AiReplyResult>;
}
export declare const aiReplyService: AiReplyService;
