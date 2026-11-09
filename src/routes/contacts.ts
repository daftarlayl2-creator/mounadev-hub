// src/routes/contacts.ts
import { Router, Request, Response } from 'express';
import { contactService } from '../services/contactService';
import { auditService } from '../services/auditService';
import { contactSchema, contactUpdateSchema, optOutSchema } from '../utils/validation';
import { authenticateAgent, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticateAgent);

// GET /contacts
router.get('/', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const result = await contactService.search({
      search: typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : undefined,
      business_type: req.query.business_type as string,
      consent_status: req.query.consent_status as string,
      assigned_agent: agent.permissions.includes('admin') ? req.query.assigned_agent as string : agent.id,
      limit: Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100),
      offset: Math.min(Math.max(parseInt(req.query.offset as string) || 0, 0), 100000),
    });
    res.json(result);
  } catch (err: any) {
    logger.error('Failed to search contacts', { error: err.message });
    res.status(500).json({ error: 'internal_error', message: 'Unable to process contact request', code: 500 });
  }
});

// GET /contacts/:id
router.get('/:id', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const contact = await contactService.getById(req.params.id, agent.permissions.includes('admin') ? undefined : agent.id);
    if (!contact) {
      res.status(404).json({ error: 'contact_not_found', message: 'Contact not found', code: 404 });
      return;
    }
    res.json(contact);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

// POST /contacts
router.post('/', requirePermission('write'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', message: parsed.error.message, code: 400 });
      return;
    }
    const contact = await contactService.create({ ...parsed.data, assigned_agent: agent.id, consent_status: 'none' });
    await auditService.log({ agentId: agent.id, action: 'create_contact', resourceType: 'contact', resourceId: contact.id, ipAddress: req.ip });
    res.status(201).json(contact);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

// PATCH /contacts/:id
router.patch('/:id', requirePermission('write'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const parsed = contactUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', message: parsed.error.message, code: 400 });
      return;
    }
    const existing = await contactService.getById(req.params.id, agent.permissions.includes('admin') ? undefined : agent.id);
    if (!existing) {
      res.status(404).json({ error: 'contact_not_found', message: 'Contact not found', code: 404 });
      return;
    }
    const contact = await contactService.update(req.params.id, parsed.data);
    await auditService.log({ agentId: agent.id, action: 'update_contact', resourceType: 'contact', resourceId: contact.id, ipAddress: req.ip });
    res.json(contact);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

// POST /contacts/:id/opt-out
router.post('/:id/opt-out', requirePermission('write'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const existing = await contactService.getById(req.params.id, agent.permissions.includes('admin') ? undefined : agent.id);
    if (!existing) {
      res.status(404).json({ error: 'contact_not_found', message: 'Contact not found', code: 404 });
      return;
    }
    const parsed = optOutSchema.strict().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', message: parsed.error.message, code: 400 });
      return;
    }
    const contact = await contactService.optOut(req.params.id, parsed.data.reason, agent.id);
    await auditService.log({ agentId: agent.id, action: 'mark_opt_out', resourceType: 'contact', resourceId: contact.id, details: { reason: parsed.data.reason }, ipAddress: req.ip });
    res.json(contact);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

// GET /contacts/:id/permission
router.get('/:id/permission', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const contact = await contactService.getById(req.params.id, agent.permissions.includes('admin') ? undefined : agent.id);
    const perm = contact ? await contactService.checkPermission(req.params.id) : { allowed: false, reason: 'contact_not_found' };
    res.json(perm);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

export default router;