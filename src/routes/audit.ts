// src/routes/audit.ts
import { Router, Request, Response } from 'express';
import { auditService } from '../services/auditService';
import { authenticateAgent, requirePermission, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateAgent);

router.get('/', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const agent = (req as AuthenticatedRequest).agent;
    // Agents may inspect only their own audit events; admin permission allows cross-agent filtering.
    const requestedAgentId = req.query.agent_id as string | undefined;
    const result = await auditService.query({
      agent_id: agent.permissions.includes('admin') ? requestedAgentId : agent.id,
      action: req.query.action as string,
      resource_type: req.query.resource_type as string,
      from_date: req.query.from_date as string,
      to_date: req.query.to_date as string,
      limit: Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100),
      offset: Math.min(Math.max(parseInt(req.query.offset as string) || 0, 0), 100000),
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: 'Unable to retrieve audit records', code: 500 });
  }
});

export default router;