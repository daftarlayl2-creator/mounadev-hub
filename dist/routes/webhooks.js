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
// src/routes/webhooks.ts
const express_1 = require("express");
const contactService_1 = require("../services/contactService");
const conversationService_1 = require("../services/conversationService");
const messageService_1 = require("../services/messageService");
const openwaAdapter_1 = require("../adapters/openwaAdapter");
const automationService_1 = require("../services/automationService");
const aiReplyService_1 = require("../services/aiReplyService");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const adapter = new openwaAdapter_1.OpenWAAdapter();
const msgService = new messageService_1.MessageService(adapter);
// GET /webhooks/whatsapp — Meta verification
router.get('/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WEBHOOK_SECRET) {
        logger_1.logger.info('Webhook verified');
        res.status(200).send(challenge);
    }
    else {
        res.status(403).send('Forbidden');
    }
});
// POST /webhooks/whatsapp — Inbound messages
router.post('/whatsapp', async (req, res) => {
    try {
        // Verify signature (simplified for OpenWA; Meta uses HMAC)
        // const signature = req.headers['x-hub-signature-256'] as string;
        // if (!adapter.verifyWebhook(req.body, signature)) {
        //   res.status(403).json({ error: 'invalid_signature' });
        //   return;
        // }
        const inboundMessages = adapter.parseInbound(req.body);
        // Respond immediately (process async)
        res.status(200).json({ received: true });
        // Process each message
        for (const msg of inboundMessages) {
            try {
                // Find or create contact
                let contact = await contactService_1.contactService.getByPhone(msg.from);
                if (!contact) {
                    contact = await contactService_1.contactService.create({
                        phone: msg.from,
                        source: 'inbound',
                        consent_status: 'none',
                    });
                }
                // Find or create conversation
                let conversation = await conversationService_1.conversationService.getByContact(contact.id);
                if (!conversation) {
                    conversation = await conversationService_1.conversationService.create(contact.id, 'whatsapp');
                }
                // Store inbound message
                await msgService.storeInbound({
                    conversationId: conversation.id,
                    content: msg.content,
                    senderPhone: msg.from,
                    providerMessageId: msg.messageId,
                    messageType: msg.type,
                });
                // Auto-consent (inbound message implies consent)
                await automationService_1.automationService.handleInboundConsent(contact.id);
                // Check for opt-out keywords
                if (automationService_1.automationService.isOptOutMessage(msg.content)) {
                    await contactService_1.contactService.optOut(contact.id, 'keyword_detected', 'system');
                    logger_1.logger.info('Auto opt-out detected', { contact: contact.id });
                }
                // Check for complaint/sensitive
                if (automationService_1.automationService.isComplaintOrSensitive(msg.content)) {
                    await automationService_1.automationService.escalateToHuman(conversation.id, 'mara', 'complaint_detected');
                    logger_1.logger.info('Complaint detected, escalated', { conversation: conversation.id });
                }
                // Route to agent
                const assignedAgent = await automationService_1.automationService.routeInbound(contact.id, conversation.id);
                if (assignedAgent !== conversation.assigned_agent) {
                    await conversationService_1.conversationService.update(conversation.id, { assigned_agent: assignedAgent });
                }
                // Determine which employee agent backs this WhatsApp conversation
                const waAgentId = contact.assigned_agent || assignedAgent || config_1.config.whatsappAgent.agentId;
                // AI auto-reply (unless opt-out or complaint escalated)
                const isOptOut = automationService_1.automationService.isOptOutMessage(msg.content);
                const isComplaint = automationService_1.automationService.isComplaintOrSensitive(msg.content);
                if (config_1.config.whatsappAgent.autoReply && !isOptOut && !isComplaint) {
                    try {
                        // Fetch recent conversation history for context
                        const recent = await msgService.getConversationMessages(conversation.id);
                        const history = (recent || [])
                            .slice(-6)
                            .map((m) => ({
                            role: m.direction === 'inbound' ? 'user' : 'assistant',
                            content: m.content,
                        }));
                        const aiResult = await aiReplyService_1.aiReplyService.generateReply({
                            agentId: waAgentId,
                            customerMessage: msg.content,
                            conversationHistory: history.slice(0, -1), // exclude the just-stored inbound (already in history? keep last as user)
                            contactName: contact.name,
                            businessName: contact.business_name,
                        });
                        if (aiResult.success && aiResult.reply) {
                            // Send via adapter and store outbound message
                            const sendResult = await adapter.sendText(contact.phone, aiResult.reply);
                            if (sendResult.success) {
                                const supabase = (await Promise.resolve().then(() => __importStar(require('../utils/supabase')))).getSupabase();
                                await supabase.from('messages').insert({
                                    conversation_id: conversation.id,
                                    direction: 'outbound',
                                    sender_type: 'agent',
                                    sender_id: waAgentId,
                                    content: aiResult.reply,
                                    message_type: 'text',
                                    status: 'sent',
                                    provider_message_id: sendResult.messageId,
                                });
                                await conversationService_1.conversationService.update(conversation.id, { last_message_at: new Date().toISOString() });
                                logger_1.logger.info('AI auto-reply sent', { conversation: conversation.id, agent: waAgentId });
                            }
                            else {
                                logger_1.logger.error('AI auto-reply send failed', { error: sendResult.error });
                            }
                        }
                        else {
                            logger_1.logger.warn('AI auto-reply not sent', { error: aiResult.error });
                        }
                    }
                    catch (aiErr) {
                        logger_1.logger.error('AI auto-reply error', { error: aiErr.message });
                    }
                }
                logger_1.logger.info('Inbound message processed', { from: msg.from, conversation: conversation.id });
            }
            catch (err) {
                logger_1.logger.error('Failed to process inbound message', { error: err.message, from: msg.from });
            }
        }
    }
    catch (err) {
        logger_1.logger.error('Webhook processing error', { error: err.message });
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
exports.default = router;
//# sourceMappingURL=webhooks.js.map