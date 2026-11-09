// src/routes/conversations.ts
import { Router, Request, Response } from 'express';
import { conversationService } from '../services/conversationService';
import { createMessageService } from '../services/messageService';
import { OpenWAAdapter } from '../adapters/openwaAdapter';
import { auditService } from '../services/auditService';
import { authenticateAgent, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { conversationCreateSchema, conversationUpdateSchema } from '../utils/validation';
import { contactService } from '../services/contactService';

const adapter = new OpenWAAdapter();
const msgService = createMessageService(adapter);

const router = Router();
router.use(authenticateAgent);

router.get('/', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const result = await conversationService.list({
      contact_id: req.query.contact_id as string,
      status: req.query.status as string,
      assigned_agent: ((req as AuthenticatedRequest).agent.permissions.includes('admin') ? req.query.assigned_agent as string : (req as AuthenticatedRequest).agent.id),
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

router.get('/:id', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const conv = await conversationService.getById(req.params.id, agent.permissions.includes('admin') ? undefined : agent.id);
    if (!conv) {
      res.status(404).json({ error: 'conversation_not_found', message: 'Conversation not found', code: 404 });
      return;
    }
    const messages = await msgService.getConversationMessages(req.params.id);
    res.json({ ...conv, messages });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

router.post('/', requirePermission('write'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const parsed = conversationCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', message: parsed.error.message, code: 400 });
      return;
    }
    const contact = await contactService.getById(parsed.data.contact_id, agent.permissions.includes('admin') ? undefined : agent.id);
    if (!contact) {
      res.status(404).json({ error: 'contact_not_found', message: 'Contact not found', code: 404 });
      return;
    }
    const conv = await conversationService.create(parsed.data.contact_id, parsed.data.channel, agent.id);
    await auditService.log({ agentId: agent.id, action: 'create_conversation', resourceType: 'conversation', resourceId: conv.id, ipAddress: req.ip });
    res.status(201).json(conv);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

router.patch('/:id', requirePermission('write'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const parsed = conversationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', message: parsed.error.message, code: 400 });
      return;
    }
    const existing = await conversationService.getById(req.params.id, agent.permissions.includes('admin') ? undefined : agent.id);
    if (!existing) {
      res.status(404).json({ error: 'conversation_not_found', message: 'Conversation not found', code: 404 });
      return;
    }
    const conv = await conversationService.update(req.params.id, parsed.data);
    await auditService.log({ agentId: agent.id, action: 'update_conversation', resourceType: 'conversation', resourceId: conv.id, details: req.body, ipAddress: req.ip });
    res.json(conv);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

router.post('/:id/close', requirePermission('write'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const existing = await conversationService.getById(req.params.id, agent.permissions.includes('admin') ? undefined : agent.id);
    if (!existing) {
      res.status(404).json({ error: 'conversation_not_found', message: 'Conversation not found', code: 404 });
      return;
    }
    const conv = await conversationService.close(req.params.id);
    await auditService.log({ agentId: agent.id, action: 'close_conversation', resourceType: 'conversation', resourceId: conv.id, ipAddress: req.ip });
    res.json(conv);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

router.post('/:id/escalate', requirePermission('write'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const existing = await conversationService.getById(req.params.id, agent.permissions.includes('admin') ? undefined : agent.id);
    if (!existing) {
      res.status(404).json({ error: 'conversation_not_found', message: 'Conversation not found', code: 404 });
      return;
    }
    const targetAgent = agent.permissions.includes('admin') && typeof req.body.agent_id === 'string' ? req.body.agent_id : 'mara';
    const conv = await conversationService.escalate(req.params.id, targetAgent);
    await auditService.log({ agentId: agent.id, action: 'escalate_conversation', resourceType: 'conversation', resourceId: conv.id, ipAddress: req.ip });
    res.json(conv);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

export default router;