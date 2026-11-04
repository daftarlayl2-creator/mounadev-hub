export interface SendResult {
    success: boolean;
    messageId: string;
    error?: string;
}
export interface MessageStatus {
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp?: Date;
}
export interface InboundMessage {
    from: string;
    messageId: string;
    content: string;
    timestamp: Date;
    type: 'text' | 'image' | 'document' | 'location' | 'audio';
}
export interface ChannelAdapter {
    sendText(to: string, content: string): Promise<SendResult>;
    sendTemplate(to: string, templateName: string, variables: Record<string, string>): Promise<SendResult>;
    sendMedia(to: string, mediaUrl: string, caption?: string): Promise<SendResult>;
    getStatus(providerMessageId: string): Promise<MessageStatus>;
    verifyWebhook(payload: any, signature: string): boolean;
    parseInbound(payload: any): InboundMessage[];
}
