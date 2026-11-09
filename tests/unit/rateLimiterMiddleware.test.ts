import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rateLimitMiddleware } from '../../src/middleware/rateLimiter';
import { contactService } from '../../src/services/contactService';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../src/services/contactService', () => ({
  contactService: { getById: vi.fn() },
}));

function makeRequest(agent: { id: string; permissions?: string[] }, contactId: string): Request {
  return {
    agent,
    body: { contact_id: contactId },
  } as unknown as Request;
}

function makeResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  };
  return res as unknown as Response & typeof res;
}

async function flushMiddleware(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('rateLimitMiddleware contact authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns contact_not_found before rate-limit evaluation when the contact is outside the agent scope', async () => {
    vi.mocked(contactService.getById).mockResolvedValue(null);
    const req = makeRequest({ id: 'agent-a', permissions: ['send'] }, 'contact-owned-by-agent-b');
    const res = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    rateLimitMiddleware(req, res, next);
    await flushMiddleware();

    expect(contactService.getById).toHaveBeenCalledWith('contact-owned-by-agent-b', 'agent-a');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'contact_not_found',
      message: 'Contact not found',
      code: 404,
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('does not apply an assigned-agent filter for admins but still requires the contact to exist', async () => {
    vi.mocked(contactService.getById).mockResolvedValue(null);
    const req = makeRequest({ id: 'admin-1', permissions: ['admin'] }, 'missing-contact');
    const res = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    rateLimitMiddleware(req, res, next);
    await flushMiddleware();

    expect(contactService.getById).toHaveBeenCalledWith('missing-contact', undefined);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });
});
