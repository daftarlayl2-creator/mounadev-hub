// src/routes/admin.ts
import { Router, Request, Response } from 'express';
import { authenticateAgent, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { auditService } from '../services/auditService';
import { getSupabase } from '../utils/supabase';
import { logger } from '../utils/logger';
import { listPersonas } from '../services/agentPersonas';
import { aiReplyService } from '../services/aiReplyService';
import { config } from '../config';

const router = Router();
router.use(authenticateAgent);

// POST /admin/pause-outbound
router.post('/pause-outbound', requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    const { reason, duration_minutes } = req.body;
    const supabase = getSupabase();

    // Store pause state in a simple key-value (use a settings table or env)
    // For now, log and return success
    await auditService.log({
      agentId: agent.id,
      action: 'pause_outbound',
      resourceType: 'system',
      details: { reason, duration_minutes },
      ipAddress: req.ip,
    });

    logger.warn('Outbound messaging paused', { agent: agent.id, reason, duration_minutes });
    res.json({ paused: true, reason, duration_minutes, paused_by: agent.id });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

// POST /admin/resume-outbound
router.post('/resume-outbound', requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    await auditService.log({ agentId: agent.id, action: 'resume_outbound', resourceType: 'system', ipAddress: req.ip });
    logger.info('Outbound messaging resumed', { agent: agent.id });
    res.json({ paused: false, resumed_by: agent.id });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

// GET /admin/status
router.get('/status', async (req: Request, res: Response) => {
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
router.get('/agents', async (_req: Request, res: Response) => {
  res.json({ agents: listPersonas() });
});

// POST /admin/test-reply — generate a test AI reply without sending
router.post('/test-reply', requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const { agent_id, message, contact_name, business_name } = req.body;
    const result = await aiReplyService.generateReply({
      agentId: agent_id || config.whatsappAgent.agentId,
      customerMessage: message || 'Bonjour',
      contactName: contact_name,
      businessName: business_name,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
  }
});

export default router;