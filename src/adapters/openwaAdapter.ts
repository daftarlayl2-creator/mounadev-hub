// src/adapters/openwaAdapter.ts
import { ChannelAdapter, SendResult, MessageStatus, InboundMessage } from './channelAdapter';
import { timingSafeEqual } from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

export class OpenWAAdapter implements ChannelAdapter {
  private baseUrl: string;
  private session: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.openwa.baseUrl;
    this.session = config.openwa.session;
    this.apiKey = config.openwa.apiKey;
  }

  private async request(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
      },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenWA request failed: ${response.status} ${text}`);
    }
    return response.json();
  }

  private maskPhone(phone: string): string {
    const normalized = phone.replace(/\D/g, '');
    return normalized.length > 4 ? `***${normalized.slice(-4)}` : '****';
  }

  async sendText(to: string, content: string): Promise<SendResult> {
    try {
      const chatId = to.includes('@') ? to : `${to.replace(/^\+/, '')}@c.us`;
      const result = await this.request(`/api/sessions/${this.session}/messages/send-text`, 'POST', {
        chatId,
        text: content,
      });
      logger.info('OpenWA text sent', { to: this.maskPhone(to), messageId: result.id });
      return { success: true, messageId: result.id || result.messageId || 'unknown' };
    } catch (err: any) {
      logger.error('OpenWA sendText failed', { to: this.maskPhone(to) });
      return { success: false, messageId: '', error: 'OpenWA provider request failed' };
    }
  }

  async sendTemplate(to: string, templateName: string, variables: Record<string, string>): Promise<SendResult> {
    // OpenWA doesn't support templates; send as text with variable substitution
    let content = templateName;
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return this.sendText(to, content);
  }

  async sendMedia(to: string, mediaUrl: string, caption?: string): Promise<SendResult> {
    try {
      const chatId = to.includes('@') ? to : `${to.replace(/^\+/, '')}@c.us`;
      const result = await this.request('/messages/send-media', 'POST', {
        session: this.session,
        chatId,
        media: mediaUrl,
        caption: caption || '',
      });
      return { success: true, messageId: result.id || result.messageId || 'unknown' };
    } catch (err: any) {
      return { success: false, messageId: '', error: err.message };
    }
  }

  async getStatus(providerMessageId: string): Promise<MessageStatus> {
    // OpenWA doesn't have a direct status endpoint; return 'sent' as default
    return { status: 'sent' };
  }

  verifyWebhook(_payload: any, signature: string): boolean {
    if (!signature || !config.webhook.secret) return false;
    const supplied = Buffer.from(signature);
    const expected = Buffer.from(config.webhook.secret);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  parseInbound(payload: any): InboundMessage[] {
    const messages: InboundMessage[] = [];
    // OpenWA webhook format: event 'message' or 'message.received'
    const isOpenWA = payload.event === 'message' || payload.event === 'message.received';
    if (isOpenWA && payload.data) {
      const d = payload.data;
      messages.push({
        from: (d.from || d.sender || d.chatId || '').replace(/@.*$/, ''),
        messageId: d.id || d.messageId || d.key?.id || '',
        content: d.body || d.text || d.content || '',
        timestamp: (() => {
          const t = d.timestamp;
          if (!t) return new Date();
          const n = Number(t);
          if (isNaN(n)) return new Date(t);
          return new Date(n > 1e12 ? n : n * 1000);
        })(),
        type: (d.type === 'image' || d.type === 'document' || d.type === 'audio' || d.type === 'location') ? d.type : 'text',
      });
    }
    // Meta Cloud API webhook format
    if (payload.entry) {
      // ... handled elsewhere
    }
    return messages;
  }
}