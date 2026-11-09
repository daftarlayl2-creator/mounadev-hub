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
