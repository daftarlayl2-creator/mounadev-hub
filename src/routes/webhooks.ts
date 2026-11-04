// src/routes/webhooks.ts
import { Router, Request, Response } from 'express';
import { contactService } from '../services/contactService';
import { conversationService } from '../services/conversationService';
import { MessageService } from '../services/messageService';
import { OpenWAAdapter } from '../adapters/openwaAdapter';
import { auditService } from '../services/auditService';
import { automationService } from '../services/automationService';
import { aiReplyService } from '../services/aiReplyService';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();
const adapter = new OpenWAAdapter();
const msgService = new MessageService(adapter);

// GET /webhooks/whatsapp — Meta verification
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_SECRET) {
    logger.info('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// POST /webhooks/whatsapp — Inbound messages
router.post('/whatsapp', async (req: Request, res: Response) => {
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
        let contact = await contactService.getByPhone(msg.from);
        if (!contact) {
          contact = await contactService.create({
            phone: msg.from,
            source: 'inbound',
            consent_status: 'none',
          });
        }

        // Find or create conversation
        let conversation = await conversationService.getByContact(contact.id);
        if (!conversation) {
          conversation = await conversationService.create(contact.id, 'whatsapp');
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
        await automationService.handleInboundConsent(contact.id);

        // Check for opt-out keywords
        if (automationService.isOptOutMessage(msg.content)) {
          await contactService.optOut(contact.id, 'keyword_detected', 'system');
          logger.info('Auto opt-out detected', { contact: contact.id });
        }

        // Check for complaint/sensitive
        if (automationService.isComplaintOrSensitive(msg.content)) {
          await automationService.escalateToHuman(conversation.id, 'mara', 'complaint_detected');
          logger.info('Complaint detected, escalated', { conversation: conversation.id });
        }

        // Route to agent
        const assignedAgent = await automationService.routeInbound(contact.id, conversation.id);
        if (assignedAgent !== conversation.assigned_agent) {
          await conversationService.update(conversation.id, { assigned_agent: assignedAgent });
        }

        // Determine which employee agent backs this WhatsApp conversation
        const waAgentId = contact.assigned_agent || assignedAgent || config.whatsappAgent.agentId;

        // AI auto-reply (unless opt-out or complaint escalated)
        const isOptOut = automationService.isOptOutMessage(msg.content);
        const isComplaint = automationService.isComplaintOrSensitive(msg.content);
        if (config.whatsappAgent.autoReply && !isOptOut && !isComplaint) {
          try {
            // Fetch recent conversation history for context
            const recent = await msgService.getConversationMessages(conversation.id);
            const history = (recent || [])
              .slice(-6)
              .map((m: any) => ({
                role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
                content: m.content,
              }));

            const aiResult = await aiReplyService.generateReply({
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
                const supabase = (await import('../utils/supabase')).getSupabase();
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
                await conversationService.update(conversation.id, { last_message_at: new Date().toISOString() });
                logger.info('AI auto-reply sent', { conversation: conversation.id, agent: waAgentId });
              } else {
                logger.error('AI auto-reply send failed', { error: sendResult.error });
              }
            } else {
              logger.warn('AI auto-reply not sent', { error: aiResult.error });
            }
          } catch (aiErr: any) {
            logger.error('AI auto-reply error', { error: aiErr.message });
          }
        }

        logger.info('Inbound message processed', { from: msg.from, conversation: conversation.id });
      } catch (err: any) {
        logger.error('Failed to process inbound message', { error: err.message, from: msg.from });
      }
    }
  } catch (err: any) {
    logger.error('Webhook processing error', { error: err.message });
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

export default router;