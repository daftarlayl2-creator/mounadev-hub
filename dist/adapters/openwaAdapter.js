"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenWAAdapter = void 0;
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
class OpenWAAdapter {
    baseUrl;
    session;
    apiKey;
    constructor() {
        this.baseUrl = config_1.config.openwa.baseUrl;
        this.session = config_1.config.openwa.session;
        this.apiKey = config_1.config.openwa.apiKey;
    }
    async request(endpoint, method = 'GET', body) {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
            },
        };
        if (body)
            options.body = JSON.stringify(body);
        const response = await fetch(url, options);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`OpenWA request failed: ${response.status} ${text}`);
        }
        return response.json();
    }
    async sendText(to, content) {
        try {
            const chatId = to.includes('@') ? to : `${to.replace(/^\+/, '')}@c.us`;
            const result = await this.request(`/api/sessions/${this.session}/messages/send-text`, 'POST', {
                chatId,
                text: content,
            });
            console.log('DEBUG result:', JSON.stringify(result));
            logger_1.logger.info('OpenWA text sent', { to, messageId: result.id });
            return { success: true, messageId: result.id || result.messageId || 'unknown' };
        }
        catch (err) {
            console.log('DEBUG error:', err.message);
            logger_1.logger.error('OpenWA sendText failed', { error: err.message, to });
            return { success: false, messageId: '', error: err.message };
        }
    }
    async sendTemplate(to, templateName, variables) {
        // OpenWA doesn't support templates; send as text with variable substitution
        let content = templateName;
        for (const [key, value] of Object.entries(variables)) {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        return this.sendText(to, content);
    }
    async sendMedia(to, mediaUrl, caption) {
        try {
            const chatId = to.includes('@') ? to : `${to.replace(/^\+/, '')}@c.us`;
            const result = await this.request('/messages/send-media', 'POST', {
                session: this.session,
                chatId,
                media: mediaUrl,
                caption: caption || '',
            });
            return { success: true, messageId: result.id || result.messageId || 'unknown' };
        }
        catch (err) {
            return { success: false, messageId: '', error: err.message };
        }
    }
    async getStatus(providerMessageId) {
        // OpenWA doesn't have a direct status endpoint; return 'sent' as default
        return { status: 'sent' };
    }
    verifyWebhook(payload, signature) {
        // OpenWA webhook verification (simplified)
        return true;
    }
    parseInbound(payload) {
        const messages = [];
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
                    if (!t)
                        return new Date();
                    const n = Number(t);
                    if (isNaN(n))
                        return new Date(t);
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
exports.OpenWAAdapter = OpenWAAdapter;
//# sourceMappingURL=openwaAdapter.js.map