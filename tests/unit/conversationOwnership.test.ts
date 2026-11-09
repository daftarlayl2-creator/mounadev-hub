import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabase } from '../../src/utils/supabase';
import { conversationService } from '../../src/services/conversationService';

vi.mock('../../src/utils/supabase', () => ({ getSupabase: vi.fn() }));

function setupQuery() {
  const filters: Array<[string, unknown]> = [];
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return query; }),
    range: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    single: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null, count: 0 }).then(resolve, reject),
  };
  vi.mocked(getSupabase).mockReturnValue({ from: vi.fn(() => query) } as any);
  return { query, filters };
}

describe('ConversationService agent ownership scoping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters both conversation and linked contact ownership in list queries', async () => {
    const { filters } = setupQuery();

    await conversationService.list({ assigned_agent: 'agent-a' });

    expect(filters).toContainEqual(['assigned_agent', 'agent-a']);
    expect(filters).toContainEqual(['contacts.assigned_agent', 'agent-a']);
  });

  it('filters both conversation and linked contact ownership in getById', async () => {
    const { filters } = setupQuery();

    await conversationService.getById('conversation-1', 'agent-a');

    expect(filters).toContainEqual(['assigned_agent', 'agent-a']);
    expect(filters).toContainEqual(['contacts.assigned_agent', 'agent-a']);
  });

  it('filters both conversation and linked contact ownership in getByContact', async () => {
    const { filters } = setupQuery();

    await conversationService.getByContact('contact-1', 'agent-a');

    expect(filters).toContainEqual(['assigned_agent', 'agent-a']);
    expect(filters).toContainEqual(['contacts.assigned_agent', 'agent-a']);
  });

  it('does not apply an agent ownership filter for admin-scoped calls', async () => {
    const { filters } = setupQuery();

    await conversationService.getById('conversation-1');

    expect(filters).toEqual([['id', 'conversation-1']]);
  });
});
