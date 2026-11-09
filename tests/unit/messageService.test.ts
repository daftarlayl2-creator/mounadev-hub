import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageService } from '../../src/services/messageService';
import { getSupabase } from '../../src/utils/supabase';
import { contactService } from '../../src/services/contactService';
import { conversationService } from '../../src/services/conversationService';

vi.mock('../../src/utils/supabase', () => ({ getSupabase: vi.fn() }));
vi.mock('../../src/services/contactService', () => ({
  contactService: { getById: vi.fn(), checkPermission: vi.fn() },
}));
vi.mock('../../src/services/conversationService', () => ({
  conversationService: {
    getByContact: vi.fn(),
    create: vi.fn(),
    isWindowExpired: vi.fn(),
    update: vi.fn(),
    getById: vi.fn(),
  },
}));

const contact = {
  id: 'contact-1',
  phone: '+212600000000',
  consent_status: 'opted_in',
  assigned_agent: 'agent-1',
};
const conversation = { id: 'conversation-1', contact_id: 'contact-1', assigned_agent: 'agent-1' };
const queuedMessage = {
  id: 'message-1',
  conversation_id: 'conversation-1',
  direction: 'outbound',
  sender_type: 'agent',
  sender_id: 'agent-1',
  content: 'Hello',
  message_type: 'text',
  status: 'queued',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function setupSupabase(options: { insertError?: Error | null; updateError?: Error | null; updateThrows?: boolean; lookupError?: Error | null } = {}) {
  const updateCalls: Record<string, unknown>[] = [];
  const lookupFilters: Array<[string, unknown]> = [];
  const supabase = {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: queuedMessage, error: options.insertError || null })),
        })),
      })),
      update: vi.fn((values: Record<string, unknown>) => {
        updateCalls.push(values);
        return { eq: vi.fn(async () => {
          if (options.updateThrows) throw new Error('database connection lost');
          return { error: options.updateError || null };
        }) };
      }),
      select: vi.fn(() => {
        const query: any = {
          eq: vi.fn((column: string, value: unknown) => { lookupFilters.push([column, value]); return query; }),
          maybeSingle: vi.fn(async () => ({ data: null, error: options.lookupError || null })),
        };
        return query;
      }),
    })),
  };
  vi.mocked(getSupabase).mockReturnValue(supabase as any);
  return { supabase, updateCalls, lookupFilters };
}

function setupServices() {
  vi.mocked(contactService.getById).mockResolvedValue(contact as any);
  vi.mocked(contactService.checkPermission).mockResolvedValue({ allowed: true });
  vi.mocked(conversationService.getByContact).mockResolvedValue(conversation as any);
  vi.mocked(conversationService.isWindowExpired).mockResolvedValue(false);
  vi.mocked(conversationService.update).mockResolvedValue(conversation as any);
}

describe('MessageService outbound outcome handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupServices();
  });

  it('preserves a confirmed provider success when message or conversation bookkeeping fails', async () => {
    const { updateCalls } = setupSupabase({ updateError: new Error('database unavailable') });
    vi.mocked(conversationService.update).mockRejectedValue(new Error('conversation update failed'));
    const adapter = { sendText: vi.fn().mockResolvedValue({ success: true, messageId: 'provider-1' }) };
    const service = new MessageService(adapter as any);

    const result = await service.send({ contactId: contact.id, content: 'Hello', agentId: 'agent-1' });

    expect(result.status).toBe('sent');
    expect(result.provider_message_id).toBe('provider-1');
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toMatchObject({ status: 'sent', provider_message_id: 'provider-1' });
  });

  it('returns the confirmed provider success when the status update throws', async () => {
    const { updateCalls } = setupSupabase({ updateThrows: true });
    const adapter = { sendText: vi.fn().mockResolvedValue({ success: true, messageId: 'provider-2' }) };
    const service = new MessageService(adapter as any);

    const result = await service.send({ contactId: contact.id, content: 'Hello', agentId: 'agent-1' });

    expect(result.status).toBe('sent');
    expect(result.provider_message_id).toBe('provider-2');
    expect(updateCalls).toHaveLength(1);
  });

  it('does not label an ambiguous transport exception as a confirmed provider failure', async () => {
    const { updateCalls } = setupSupabase();
    const adapter = { sendText: vi.fn().mockRejectedValue(new Error('socket timeout')) };
    const service = new MessageService(adapter as any);

    await expect(service.send({ contactId: contact.id, content: 'Hello', agentId: 'agent-1' }))
      .rejects.toThrow('send_outcome_unknown');

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).not.toHaveProperty('status');
    expect(updateCalls[0]).toHaveProperty('error_message', 'send_outcome_unknown');
  });

  it('blocks a send when the idempotency lookup itself fails', async () => {
    const { lookupFilters } = setupSupabase({ lookupError: new Error('database unavailable') });
    const service = new MessageService({ sendText: vi.fn() } as any);

    await expect(service.getByIdempotencyKey('request-1', 'agent-1', contact.id))
      .rejects.toThrow('Unable to verify message idempotency; send blocked');
    expect(lookupFilters).toEqual([
      ['direction', 'outbound'],
      ['idempotency_key', 'request-1'],
      ['sender_id', 'agent-1'],
    ]);
  });
});
