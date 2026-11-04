import { ChannelAdapter } from '../adapters/channelAdapter';
export interface Message {
    id: string;
    conversation_id: string;
    direction: 'outbound' | 'inbound';
    sender_type: 'agent' | 'customer' | 'system';
    sender_id?: string;
    content: string;
    message_type: string;
    template_name?: string;
    status: string;
    provider_message_id?: string;
    idempotency_key?: string;
    error_message?: string;
    created_at: string;
    updated_at: string;
}
export declare class MessageService {
    private adapter;
    constructor(adapter: ChannelAdapter);
    send(params: {
        contactId: string;
        content: string;
        messageType?: string;
        idempotencyKey?: string;
        templateName?: string;
        variables?: Record<string, string>;
        agentId: string;
    }): Promise<Message>;
    getByIdempotencyKey(key: string): Promise<Message | null>;
    getConversationMessages(conversationId: string, limit?: number): Promise<Message[]>;
    updateStatus(messageId: string, status: string, providerMessageId?: string): Promise<void>;
    storeInbound(params: {
        conversationId: string;
        content: string;
        senderPhone: string;
        providerMessageId: string;
        messageType?: string;
    }): Promise<Message>;
}
export declare const createMessageService: (adapter: any) => MessageService;
