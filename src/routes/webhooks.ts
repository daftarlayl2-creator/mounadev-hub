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
import { checkRateLimit } from '../middleware/rateLimiter';

const router = Router();
const adapter = new OpenWAAdapter();
const msgService = new MessageService(adapter);


// GET /webhooks/whatsapp — Meta verification
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && typeof token === 'string' && token === config.webhook.secret) {
    logger.info('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// POST /webhooks/whatsapp — Inbound messages
router.post('/whatsapp', async (req: Request, res: Response) => {
  try {
    // OpenWA signs the exact JSON request body with HMAC-SHA256.
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.get('x-openwa-signature') || undefined;
    if (!adapter.verifyWebhook(rawBody, signature)) {
      res.status(401).json({ error: 'invalid_webhook_signature' });
      return;
    }

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

        // Provider message IDs make webhook retries idempotent.
        if (msg.messageId) {
          const supabase = (await import('../utils/supabase')).getSupabase();
          const { data: duplicate, error: duplicateError } = await supabase.from('messages').select('id').eq('provider_message_id', msg.messageId).maybeSingle();
          if (duplicateError) throw new Error('Unable to verify inbound message idempotency');
          if (duplicate) continue;
        }

        // Store inbound message
        await msgService.storeInbound({
          conversationId: conversation.id,
          content: msg.content,
          senderPhone: msg.from,
          providerMessageId: msg.messageId,
          messageType: msg.type,
        });

        // An inbound message is not, by itself, explicit marketing consent.

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
        const isComplaintDetected = automationService.isComplaintOrSensitive(msg.content);
        const assignedAgent = isComplaintDetected ? 'mara' : await automationService.routeInbound(contact.id, conversation.id);
        if (assignedAgent !== conversation.assigned_agent) {
          await conversationService.update(conversation.id, { assigned_agent: assignedAgent });
        }
        if (contact.assigned_agent !== assignedAgent) {
          contact = await contactService.update(contact.id, { assigned_agent: assignedAgent });
        }

        // Determine which employee agent backs this WhatsApp conversation
        const waAgentId = contact.assigned_agent || assignedAgent || config.whatsappAgent.agentId;

        // AI auto-reply (unless opt-out or complaint escalated)
        const isOptOut = automationService.isOptOutMessage(msg.content);
        const isComplaint = isComplaintDetected;
        if (config.whatsappAgent.autoReply && !isOptOut && !isComplaint) {
          try {
            const limit = await checkRateLimit(waAgentId, contact.id);
            if (!limit.allowed) {
              logger.warn('Webhook auto-reply blocked by outbound rate limit', { agent: waAgentId, reason: limit.reason });
              continue;
            }
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

        logger.info('Inbound message processed', { from: '***' + msg.from.slice(-4), conversation: conversation.id });
      } catch (err: any) {
        logger.error('Failed to process inbound message', { error: err.message, from: '***' + msg.from.slice(-4) });
      }
    }
  } catch (err: any) {
    logger.error('Webhook processing error', { error: err.message });
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

export default router;