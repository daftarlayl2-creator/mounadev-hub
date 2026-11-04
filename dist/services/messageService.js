"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMessageService = exports.MessageService = void 0;
const logger_1 = require("../utils/logger");
const contactService_1 = require("./contactService");
const conversationService_1 = require("./conversationService");
class MessageService {
    adapter;
    constructor(adapter) {
        this.adapter = adapter;
    }
    async send(params) {
        const { contactId, content, messageType = 'text', idempotencyKey, templateName, variables, agentId } = params;
        // 1. Check idempotency
        if (idempotencyKey) {
            const existing = await this.getByIdempotencyKey(idempotencyKey);
            if (existing) {
                logger_1.logger.info('Duplicate message detected, returning existing', { idempotencyKey });
                return existing;
            }
        }
        // 2. Get contact
        const contact = await contactService_1.contactService.getById(contactId);
        if (!contact)
            throw new Error('contact_not_found');
        // 3. Check contact permission
        const perm = await contactService_1.contactService.checkPermission(contactId);
        if (!perm.allowed)
            throw new Error(perm.reason);
        // 4. Get or create conversation
        let conversation = await conversationService_1.conversationService.getByContact(contactId);
        if (!conversation) {
            conversation = await conversationService_1.conversationService.create(contactId, 'whatsapp', agentId);
        }
        // 5. Check 24h window (for Meta; OpenWA doesn't enforce)
        if (messageType !== 'template') {
            const expired = await conversationService_1.conversationService.isWindowExpired(conversation.id);
            // Only enforce for Meta adapter; OpenWA has no window
            // For now, log warning but don't block for OpenWA
            if (expired) {
                logger_1.logger.warn('24h window expired, consider using template', { conversation: conversation.id });
            }
        }
        // 6. Create message record (queued)
        const supabase = (await Promise.resolve().then(() => __importStar(require('../utils/supabase')))).getSupabase();
        const { data: message, error } = await supabase
            .from('messages')
            .insert({
            conversation_id: conversation.id,
            direction: 'outbound',
            sender_type: 'agent',
            sender_id: agentId,
            content,
            message_type: messageType,
            template_name: templateName,
            status: 'queued',
            idempotency_key: idempotencyKey,
        })
            .select()
            .single();
        if (error)
            throw new Error(`Failed to create message: ${error.message}`);
        // 7. Send via channel adapter
        try {
            let result;
            if (messageType === 'template' && templateName) {
                result = await this.adapter.sendTemplate(contact.phone, templateName, variables || {});
            }
            else {
                result = await this.adapter.sendText(contact.phone, content);
            }
            if (result.success) {
                await supabase
                    .from('messages')
                    .update({ status: 'sent', provider_message_id: result.messageId, updated_at: new Date().toISOString() })
                    .eq('id', message.id);
                // Update conversation last_message_at
                await conversationService_1.conversationService.update(conversation.id, { last_message_at: new Date().toISOString() });
                logger_1.logger.info('Message sent', { messageId: message.id, providerId: result.messageId, agent: agentId });
                return { ...message, status: 'sent', provider_message_id: result.messageId };
            }
            else {
                await supabase
                    .from('messages')
                    .update({ status: 'failed', error_message: result.error, updated_at: new Date().toISOString() })
                    .eq('id', message.id);
                throw new Error(`provider_error: ${result.error}`);
            }
        }
        catch (err) {
            await supabase
                .from('messages')
                .update({ status: 'failed', error_message: err.message, updated_at: new Date().toISOString() })
                .eq('id', message.id);
            throw err;
        }
    }
    async getByIdempotencyKey(key) {
        const supabase = (await Promise.resolve().then(() => __importStar(require('../utils/supabase')))).getSupabase();
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('idempotency_key', key)
            .single();
        if (error)
            return null;
        return data;
    }
    async getConversationMessages(conversationId, limit = 50) {
        const supabase = (await Promise.resolve().then(() => __importStar(require('../utils/supabase')))).getSupabase();
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })
            .limit(limit);
        if (error)
            throw new Error(`Failed to get messages: ${error.message}`);
        return data || [];
    }
    async updateStatus(messageId, status, providerMessageId) {
        const supabase = (await Promise.resolve().then(() => __importStar(require('../utils/supabase')))).getSupabase();
        const updates = { status, updated_at: new Date().toISOString() };
        if (providerMessageId)
            updates.provider_message_id = providerMessageId;
        await supabase.from('messages').update(updates).eq('id', messageId);
    }
    async storeInbound(params) {
        const supabase = (await Promise.resolve().then(() => __importStar(require('../utils/supabase')))).getSupabase();
        const { data, error } = await supabase
            .from('messages')
            .insert({
            conversation_id: params.conversationId,
            direction: 'inbound',
            sender_type: 'customer',
            sender_id: params.senderPhone,
            content: params.content,
            message_type: params.messageType || 'text',
            status: 'received',
            provider_message_id: params.providerMessageId,
        })
            .select()
            .single();
        if (error)
            throw new Error(`Failed to store inbound message: ${error.message}`);
        // Update conversation window (reset 24h)
        await conversationService_1.conversationService.update(params.conversationId, {
            last_message_at: new Date().toISOString(),
            window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        logger_1.logger.info('Inbound message stored', { messageId: data.id, from: params.senderPhone });
        return data;
    }
}
exports.MessageService = MessageService;
const createMessageService = (adapter) => new MessageService(adapter);
exports.createMessageService = createMessageService;
//# sourceMappingURL=messageService.js.map