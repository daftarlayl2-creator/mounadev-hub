// tests/unit/auth.test.ts
import { describe, it, expect, vi } from 'vitest';
import { requirePermission, AuthenticatedRequest, isValidAgentApiKey } from '../../src/middleware/auth';
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

  it('rejects shared-resource management for agents with write but not manage', () => {
    const req = makeRequest(['read', 'write']);
    const res = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    requirePermission('manage')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows shared-resource management for agents with manage permission', () => {
    const req = makeRequest(['read', 'manage']);
    const res = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    requirePermission('manage')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
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
import { createHmac } from 'crypto';
import { verifyOpenWaSignature } from '../../src/adapters/openwaAdapter';
import { contactSchema, contactUpdateSchema, conversationCreateSchema, templateSchema, templateMessageSchema } from '../../src/utils/validation';

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

  it('rejects oversized template variable arrays', () => {
    const result = templateSchema.safeParse({
      name: 'welcome', content: 'Hello', variables: Array.from({ length: 101 }, (_, i) => `v${i}`),
    });
    expect(result.success).toBe(false);
  });

  it('rejects oversized template variable maps', () => {
    const variables = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`v${i}`, 'x']));
    const result = templateMessageSchema.safeParse({
      contact_id: '00000000-0000-4000-8000-000000000000', template_name: 'welcome', variables,
    });
    expect(result.success).toBe(false);
  });
});

describe('OpenWA webhook HMAC verification', () => {
  const secret = 'test-webhook-secret-with-sufficient-entropy';
  const body = Buffer.from('{"event":"message.received","data":{"from":"212600000000","body":"hello"}}');
  const signature = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

  it('accepts a valid provider HMAC signature over the raw body', () => {
    expect(verifyOpenWaSignature(body, signature, secret)).toBe(true);
  });

  it('rejects altered payload bytes', () => {
    expect(verifyOpenWaSignature(Buffer.from(body.toString() + ' '), signature, secret)).toBe(false);
  });

  it('rejects missing, malformed, or wrong-secret signatures', () => {
    expect(verifyOpenWaSignature(body, undefined, secret)).toBe(false);
    expect(verifyOpenWaSignature(body, signature, 'another-secret')).toBe(false);
    expect(verifyOpenWaSignature(body, 'sha256=bad', secret)).toBe(false);
  });
});


import { getMessageIdempotencyKey } from '../../src/routes/webhooks';

describe('OpenWA delivery idempotency keys', () => {
  it('creates distinct stable keys for messages in the same provider delivery', () => {
    const first = getMessageIdempotencyKey('delivery-1', 'message-a', 0);
    const second = getMessageIdempotencyKey('delivery-1', 'message-b', 1);
    expect(first).toBe('delivery-1:message-a');
    expect(second).toBe('delivery-1:message-b');
    expect(first).not.toBe(second);
  });

  it('uses a stable per-position suffix when a provider message ID is absent', () => {
    expect(getMessageIdempotencyKey('delivery-1', undefined, 0)).toBe('delivery-1:0');
    expect(getMessageIdempotencyKey('delivery-1', undefined, 1)).toBe('delivery-1:1');
  });

  it('leaves idempotency disabled when the provider supplies no delivery key', () => {
    expect(getMessageIdempotencyKey(undefined, 'message-a', 0)).toBeUndefined();
  });
});


describe('agent API key header validation', () => {
  it('accepts a well-formed opaque agent key', () => {
    expect(isValidAgentApiKey('caissa_sami_0123456789abcdef0123456789abcdef')).toBe(true);
  });

  it.each([undefined, null, '', 42, ['key'], 'has whitespace', 'line\\nbreak', 'x'.repeat(257)])(
    'rejects malformed or oversized key input: %s',
    (value) => expect(isValidAgentApiKey(value)).toBe(false),
  );
});
