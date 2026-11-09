// src/routes/admin.ts
import { Router, Request, Response } from 'express';
import { authenticateAgent, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { auditService } from '../services/auditService';
import { getSupabase } from '../utils/supabase';
import { logger } from '../utils/logger';
import { listPersonas } from '../services/agentPersonas';
import { aiReplyService } from '../services/aiReplyService';
import { config } from '../config';
import { z } from 'zod';

const router = Router();
router.use(authenticateAgent);

// POST /admin/pause-outbound
router.post('/pause-outbound', requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const parsed = z.object({ reason: z.string().max(500).optional(), duration_minutes: z.number().int().min(1).max(1440).default(60) }).strict().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', message: parsed.error.message, code: 400 });
      return;
    }
    const { reason, duration_minutes } = parsed.data;
    const supabase = getSupabase();
    const { error } = await supabase.from('audit_log').insert({
      agent_id: agent.id, action: 'pause_outbound', resource_type: 'system',
      details: { reason: reason || 'emergency_stop', duration_minutes }, ip_address: req.ip,
    });
    if (error) throw new Error('Unable to persist outbound pause state');

    logger.warn('Outbound messaging paused', { agent: agent.id, reason, duration_minutes });
    res.json({ paused: true, reason, duration_minutes, paused_by: agent.id });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: 'Unable to process administrative request', code: 500 });
  }
});

// POST /admin/resume-outbound
router.post('/resume-outbound', requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const supabase = getSupabase();
    const { error } = await supabase.from('audit_log').insert({ agent_id: agent.id, action: 'resume_outbound', resource_type: 'system', ip_address: req.ip });
    if (error) throw new Error('Unable to persist outbound resume state');
    logger.info('Outbound messaging resumed', { agent: agent.id });
    res.json({ paused: false, resumed_by: agent.id });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

// GET /admin/status
router.get('/status', requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { count: totalMessages } = await supabase.from('messages').select('*', { count: 'exact', head: true });
    const { count: totalContacts } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
    const { count: activeConversations } = await supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'active');

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      stats: {
        total_messages: totalMessages || 0,
        total_contacts: totalContacts || 0,
        active_conversations: activeConversations || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

// GET /admin/agents — list employee agents available to back the WhatsApp agent
router.get('/agents', requirePermission('read'), async (_req: Request, res: Response) => {
  res.json({ agents: listPersonas() });
});

// POST /admin/test-reply — generate a test AI reply without sending
router.post('/test-reply', requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const parsed = z.object({
      agent_id: z.string().min(1).max(64).optional(),
      message: z.string().min(1).max(4000).default('Bonjour'),
      contact_name: z.string().max(100).optional(),
      business_name: z.string().max(200).optional(),
    }).strict().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation_error', message: parsed.error.message, code: 400 });
      return;
    }
    const { agent_id, message, contact_name, business_name } = parsed.data;
    const result = await aiReplyService.generateReply({
      agentId: agent_id || config.whatsappAgent.agentId,
      customerMessage: message,
      contactName: contact_name,
      businessName: business_name,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

export default router;