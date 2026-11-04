// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { getSupabase } from '../utils/supabase';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  agent: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
}

export async function authenticateAgent(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-agent-key'] as string;

  if (!apiKey) {
    res.status(401).json({ error: 'agent_not_found', message: 'Missing X-Agent-Key header', code: 401 });
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, name, role, api_key_hash, permissions');

    if (error || !agents) {
      logger.error('Failed to fetch agents', { error });
      res.status(500).json({ error: 'internal_error', message: 'Authentication service unavailable', code: 500 });
      return;
    }

    // Find matching agent by comparing hashed key
    let matchedAgent = null;
    for (const agent of agents) {
      if (agent.api_key_hash && await bcrypt.compare(apiKey, agent.api_key_hash)) {
        matchedAgent = agent;
        break;
      }
    }

    if (!matchedAgent) {
      logger.warn('Authentication failed', { ip: req.ip });
      res.status(401).json({ error: 'agent_not_found', message: 'Invalid agent API key', code: 401 });
      return;
    }

    (req as AuthenticatedRequest).agent = {
      id: matchedAgent.id,
      name: matchedAgent.name,
      role: matchedAgent.role,
      permissions: matchedAgent.permissions || [],
    };

    next();
  } catch (err) {
    logger.error('Authentication error', { error: err });
    res.status(500).json({ error: 'internal_error', message: 'Authentication failed', code: 500 });
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const agent = (req as AuthenticatedRequest).agent;
    if (!agent || !agent.permissions.includes(permission)) {
      res.status(403).json({
        error: 'agent_not_permitted',
        message: `Agent lacks '${permission}' permission`,
        code: 403,
      });
      return;
    }
    next();
  };
}