// src/routes/templates.ts
import { Router, Request, Response } from 'express';
import { getSupabase } from '../utils/supabase';
import { templateSchema, templateUpdateSchema } from '../utils/validation';
import { authenticateAgent, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { auditService } from '../services/auditService';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticateAgent);

router.get('/', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('message_templates').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

router.post('/', requirePermission('write'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', message: parsed.error.message, code: 400 });
      return;
    }
    const supabase = getSupabase();
    const { data, error } = await supabase.from('message_templates').insert(parsed.data).select().single();
    if (error) throw error;
    await auditService.log({ agentId: agent.id, action: 'create_template', resourceType: 'template', resourceId: data.id, ipAddress: req.ip });
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

router.patch('/:id', requirePermission('write'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const parsed = templateUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', message: parsed.error.message, code: 400 });
      return;
    }
    const supabase = getSupabase();
    const { data, error } = await supabase.from('message_templates').update(parsed.data).eq('id', req.params.id).select().single();
    if (error) throw error;
    await auditService.log({ agentId: agent.id, action: 'update_template', resourceType: 'template', resourceId: data.id, ipAddress: req.ip });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

router.post('/:id/submit', requirePermission('write'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const supabase = getSupabase();
    const { data, error } = await supabase.from('message_templates').update({ status: 'pending' }).eq('id', req.params.id).select().single();
    if (error) throw error;
    await auditService.log({ agentId: agent.id, action: 'submit_template', resourceType: 'template', resourceId: data.id, ipAddress: req.ip });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

export default router;