// src/services/aiReplyService.ts
import { config } from '../config';
import { logger } from '../utils/logger';
import { getPersona } from './agentPersonas';

export interface AiReplyResult {
  success: boolean;
  reply: string;
  error?: string;
}

export class AiReplyService {
  private apiUrl: string;
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiUrl = config.hermes.apiUrl;
    this.apiKey = config.hermes.apiKey;
    this.model = config.hermes.model;
  }

  // Generate an AI reply for an inbound customer message using the given employee agent persona.
  async generateReply(params: {
    agentId: string;
    customerMessage: string;
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
    contactName?: string;
    businessName?: string;
  }): Promise<AiReplyResult> {
    const persona = getPersona(params.agentId);

    const messages: { role: string; content: string }[] = [
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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

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
        logger.error('AI reply request failed', { status: res.status });
        return { success: false, reply: '', error: `http_${res.status}` };
      }

      const data: any = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim() || '';
      if (!reply) {
        return { success: false, reply: '', error: 'empty_reply' };
      }
      return { success: true, reply };
    } catch (err: any) {
      logger.error('AI reply generation failed', { error: err.message });
      return { success: false, reply: '', error: err.message };
    }
  }
}

export const aiReplyService = new AiReplyService();
