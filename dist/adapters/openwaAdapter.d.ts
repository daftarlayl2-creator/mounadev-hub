import { ChannelAdapter, SendResult, MessageStatus, InboundMessage } from './channelAdapter';
export declare class OpenWAAdapter implements ChannelAdapter {
    private baseUrl;
    private session;
    private apiKey;
    constructor();
    private request;
    sendText(to: string, content: string): Promise<SendResult>;
    sendTemplate(to: string, templateName: string, variables: Record<string, string>): Promise<SendResult>;
    sendMedia(to: string, mediaUrl: string, caption?: string): Promise<SendResult>;
    getStatus(providerMessageId: string): Promise<MessageStatus>;
    verifyWebhook(payload: any, signature: string): boolean;
    parseInbound(payload: any): InboundMessage[];
}
