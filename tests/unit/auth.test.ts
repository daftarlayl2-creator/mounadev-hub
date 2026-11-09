// tests/unit/auth.test.ts
import { describe, it, expect, vi } from 'vitest';
import { requirePermission, AuthenticatedRequest } from '../../src/middleware/auth';
import { Request, Response, NextFunction } from 'express';

function makeRequest(permissions: string[] = []): Request {
  return {
    agent: { id: 'agent-1', name: 'Test Agent', role: 'test', permissions },
  } as unknown as AuthenticatedRequest;
}

function makeResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & typeof res;
}

describe('requirePermission middleware', () => {
  it('continues when the agent has the required permission', () => {
    const req = makeRequest(['read']);
    const res = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    requirePermission('read')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('rejects an agent missing the required permission', () => {
    const req = makeRequest(['send']);
    const res = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    requirePermission('read')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'agent_not_permitted',
      message: "Agent lacks 'read' permission",
      code: 403,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when no authenticated agent is present', () => {
    const req = {} as Request;
    const res = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    requirePermission('read')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

import { AutomationService } from '../../src/services/automationService';
import { contactSchema, contactUpdateSchema, conversationCreateSchema } from '../../src/utils/validation';

describe('security validation regressions', () => {
  const automation = new AutomationService();

  it.each(['STOP', 'unsubscribe', 'opt out', 'opt-out', 'please stop messaging me', 'arrêter', 'arrêtez', 'désabonner', 'لا ترسل لي', 'وقف'])(
    'recognizes explicit opt-out phrase: %s',
    (message) => expect(automation.isOptOutMessage(message)).toBe(true),
  );

  it.each(['I have no questions', 'No problem', 'knowledge base', 'stopwatch', 'désabonnement information', 'لا مشكلة'])(
    'does not match ordinary text as opt-out: %s',
    (message) => expect(automation.isOptOutMessage(message)).toBe(false),
  );

  it('rejects client-supplied consent and assignment fields on contact creation', () => {
    const result = contactSchema.safeParse({ phone: '+212600000000', consent_status: 'opted_in', assigned_agent: 'mara' });
    expect(result.success).toBe(false);
  });

  it('rejects protected fields on contact update', () => {
    const result = contactUpdateSchema.safeParse({ consent_status: 'opted_in', assigned_agent: 'mara' });
    expect(result.success).toBe(false);
  });

  it('rejects client-controlled assignment on conversation creation', () => {
    const result = conversationCreateSchema.safeParse({ contact_id: '00000000-0000-4000-8000-000000000000', assigned_agent: 'mara' });
    expect(result.success).toBe(false);
  });
});
