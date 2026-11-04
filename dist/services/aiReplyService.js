"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiReplyService = exports.AiReplyService = void 0;
// src/services/aiReplyService.ts
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const agentPersonas_1 = require("./agentPersonas");
class AiReplyService {
    apiUrl;
    apiKey;
    model;
    constructor() {
        this.apiUrl = config_1.config.hermes.apiUrl;
        this.apiKey = config_1.config.hermes.apiKey;
        this.model = config_1.config.hermes.model;
    }
    // Generate an AI reply for an inbound customer message using the given employee agent persona.
    async generateReply(params) {
        const persona = (0, agentPersonas_1.getPersona)(params.agentId);
        const messages = [
            { role: 'system', content: persona.systemPrompt },
        ];
        if (params.contactName || params.businessName) {
            messages.push({
                role: 'system',
                content: `Contexte client: nom=${params.contactName || 'inconnu'}, entreprise=${params.businessName || 'inconnue'}.`,
            });
        }
        // Include recent conversation history for context
        if (params.conversationHistory && params.conversationHistory.length > 0) {
            for (const m of params.conversationHistory) {
                messages.push({ role: m.role, content: m.content });
            }
        }
        messages.push({ role: 'user', content: params.customerMessage });
        try {
            const url = `${this.apiUrl}/v1/chat/completions`;
            const headers = { 'Content-Type': 'application/json' };
            if (this.apiKey)
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: this.model,
                    messages,
                    temperature: 0.7,
                    max_tokens: 300,
                }),
            });
            if (!res.ok) {
                const text = await res.text();
                logger_1.logger.error('AI reply request failed', { status: res.status, body: text });
                return { success: false, reply: '', error: `http_${res.status}: ${text}` };
            }
            const data = await res.json();
            const reply = data?.choices?.[0]?.message?.content?.trim() || '';
            if (!reply) {
                return { success: false, reply: '', error: 'empty_reply' };
            }
            return { success: true, reply };
        }
        catch (err) {
            logger_1.logger.error('AI reply generation failed', { error: err.message });
            return { success: false, reply: '', error: err.message };
        }
    }
}
exports.AiReplyService = AiReplyService;
exports.aiReplyService = new AiReplyService();
//# sourceMappingURL=aiReplyService.js.map