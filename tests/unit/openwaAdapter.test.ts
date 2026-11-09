import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenWAAdapter } from '../../src/adapters/openwaAdapter';

describe('OpenWA outbound transport outcome classification', () => {
  let adapter: OpenWAAdapter;

  beforeEach(() => {
    adapter = new OpenWAAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('propagates network failures so callers can mark the outcome unknown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket timeout')));

    await expect(adapter.sendText('+212600000000', 'Hello')).rejects.toThrow('socket timeout');
  });

  it('treats explicit 4xx responses as provider rejections', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    }));

    await expect(adapter.sendText('+212600000000', 'Hello')).resolves.toMatchObject({
      success: false,
      error: 'OpenWA provider rejected request (400)',
    });
  });

  it('propagates 5xx responses because provider acceptance may be ambiguous', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }));

    await expect(adapter.sendText('+212600000000', 'Hello')).rejects.toThrow('HTTP 503');
  });

  it('propagates ambiguous media transport failures too', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection reset')));

    await expect(adapter.sendMedia('+212600000000', 'https://example.com/image.png'))
      .rejects.toThrow('connection reset');
  });
});


describe('OpenWA message status lookup', () => {
  it('fails explicitly when provider status cannot be verified', async () => {
    const adapter = new OpenWAAdapter();
    await expect(adapter.getStatus('provider-message-id'))
      .rejects.toThrow('OpenWA message status lookup is not supported');
  });
});
