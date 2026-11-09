// src/routes/messages.ts
import { Router, Request, Response } from 'express';
import { createMessageService } from '../services/messageService';
import { OpenWAAdapter } from '../adapters/openwaAdapter';
import { contactService } from '../services/contactService';
import { conversationService } from '../services/conversationService';
import { auditService } from '../services/auditService';
import { messageSchema } from '../utils/validation';
import { authenticateAgent, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

const adapter = new OpenWAAdapter();
const msgService = createMessageService(adapter);

const router = Router();

router.use(authenticateAgent);

// POST /messages/send
router.post('/send', requirePermission('send'), rateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', message: parsed.error.message, code: 400 });
      return;
    }

    const { contact_id, content, message_type, idempotency_key, template_name } = parsed.data;
    const contact = await contactService.getById(contact_id, agent.permissions.includes('admin') ? undefined : agent.id);
    if (!contact) {
      res.status(404).json({ error: 'contact_not_found', message: 'Contact not found', code: 404 });
      return;
    }

    const message = await msgService.send({
      contactId: contact_id,
      content,
      messageType: message_type,
      idempotencyKey: idempotency_key,
      templateName: template_name,
      agentId: agent.id,
    });

    await auditService.log({
      agentId: agent.id,
      action: 'send_message',
      resourceType: 'message',
      resourceId: message.id,
      details: { contact_id, message_type, content_length: content.length },
      ipAddress: req.ip,
    });

    res.status(201).json(message);
  } catch (err: any) {
    logger.error('Failed to send message', { error: err.message });

    const errorMap: Record<string, { status: number; code: string }> = {
      'contact_not_found': { status: 404, code: 'contact_not_found' },
      'contact_opted_out': { status: 403, code: 'contact_opted_out' },
      'consent_required': { status: 403, code: 'consent_required' },
    };

    const mapped = errorMap[err.message];
    if (mapped) {
      res.status(mapped.status).json({ error: mapped.code, message: err.message, code: mapped.status });
      return;
    }

    if (err.message.startsWith('provider_error')) {
      res.status(502).json({ error: 'provider_error', message: err.message, code: 502 });
      return;
    }

    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

// POST /messages/send-template
router.post('/send-template', requirePermission('send'), rateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const { contact_id, template_name, variables, idempotency_key } = req.body;
    if (typeof contact_id !== 'string' || typeof template_name !== 'string' ||
        (variables !== undefined && (typeof variables !== 'object' || variables === null || Array.isArray(variables))) ||
        (idempotency_key !== undefined && typeof idempotency_key !== 'string')) {
      res.status(400).json({ error: 'validation_error', message: 'Invalid template message payload', code: 400 });
      return;
    }
    const contact = await contactService.getById(contact_id, agent.permissions.includes('admin') ? undefined : agent.id);
    if (!contact) {
      res.status(404).json({ error: 'contact_not_found', message: 'Contact not found', code: 404 });
      return;
    }

    const message = await msgService.send({
      contactId: contact_id,
      content: `Template: ${template_name}`,
      messageType: 'template',
      idempotencyKey: idempotency_key,
      templateName: template_name,
      variables,
      agentId: agent.id,
    });

    await auditService.log({
      agentId: agent.id,
      action: 'send_template',
      resourceType: 'message',
      resourceId: message.id,
      details: { contact_id, template_name },
      ipAddress: req.ip,
    });

    res.status(201).json(message);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

// GET /messages/:id/status
router.get('/:id/status', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const supabase = (await import('../utils/supabase')).getSupabase();
    const { data, error } = await supabase.from('messages').select('id, status, provider_message_id, updated_at, conversation_id').eq('id', req.params.id).single();
    if (error || !data) {
      res.status(404).json({ error: 'message_not_found', message: 'Message not found', code: 404 });
      return;
    }
    const conversation = await conversationService.getById(data.conversation_id, agent.permissions.includes('admin') ? undefined : agent.id);
    if (!conversation) {
      res.status(404).json({ error: 'message_not_found', message: 'Message not found', code: 404 });
      return;
    }
    const { conversation_id: _conversationId, ...safeData } = data;
    res.json(safeData);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: 'Unable to retrieve message status', code: 500 });
  }
});

// GET /messages/conversation/:conversationId
router.get('/conversation/:conversationId', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const conversation = await conversationService.getById(req.params.conversationId, agent.permissions.includes('admin') ? undefined : agent.id);
    if (!conversation) {
      res.status(404).json({ error: 'conversation_not_found', message: 'Conversation not found', code: 404 });
      return;
    }
    const messages = await msgService.getConversationMessages(req.params.conversationId);
    res.json({ data: messages });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

export default router;