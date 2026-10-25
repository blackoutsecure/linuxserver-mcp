import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '../services/cache.js';
import { fetchImages, normalizeApiImage } from '../services/linuxserver-api.js';
import { fetchPublicText } from '../services/public-http.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('authoritative LinuxServer API boundary', () => {
  it.each([
    [{ name: 'sonarr', deprecated: false }],
    { data: [{ name: 'sonarr', deprecated: false }] },
    {
      data: {
        repositories: { linuxserver: [{ name: 'sonarr', deprecated: false }] }
      }
    },
    { images: [{ name: 'sonarr', deprecated: false }] }
  ])(
    'normalizes supported API envelopes without losing explicit false',
    async (body) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(body));
      const result = await fetchImages(fetcher, new MemoryCache());
      expect(result[0]).toMatchObject({ name: 'sonarr', deprecated: false });
      expect(fetcher.mock.calls[0][1]?.redirect).toBe('error');
      expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    }
  );

  it('keeps missing lifecycle metadata unknown and preserves deprecated records', () => {
    expect(
      normalizeApiImage({ name: 'legacy', deprecated: true })?.deprecated
    ).toBe(true);
    expect(normalizeApiImage({ name: 'app' })?.deprecated).toBeUndefined();
    expect(
      normalizeApiImage({ name: 'app', deprecated: 'unknown' })?.deprecated
    ).toBeUndefined();
  });

  it.each([
    Response.json({ message: 'not a catalogue' }),
    Response.json([{ no_name: true }]),
    new Response('invalid JSON', {
      headers: { 'Content-Type': 'application/json' }
    }),
    new Response('unavailable', { status: 503 }),
    new Response('<html>not API metadata</html>', {
      headers: { 'Content-Type': 'text/html' }
    })
  ])(
    'does not convert upstream/schema failures into an empty successful catalogue',
    async (response) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(
        fetchImages(fetcher, new MemoryCache())
      ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    }
  );

  it('validates external cache values before using them', async () => {
    const store = new MemoryCache();
    store.setExternal({
      get: async () => '{"untrusted":"not a normalized image list"}',
      put: async () => {}
    });
    const fetcher = vi.fn<typeof fetch>();
    await expect(fetchImages(fetcher, store)).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE'
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    'http://127.0.0.1',
    'https://169.254.169.254',
    'https://api.linuxserver.io.evil.invalid'
  ])(
    'rejects a non-authoritative API origin %s before fetching',
    async (base) => {
      vi.stubEnv('LSIO_API_BASE_URL', base);
      const fetcher = vi.fn<typeof fetch>();
      await expect(
        fetchImages(fetcher, new MemoryCache())
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(fetcher).not.toHaveBeenCalled();
    }
  );

  it('enforces response size, content type, timeout and redirect boundaries', async () => {
    const excessive = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ content: 'x'.repeat(30) }));
    await expect(
      fetchPublicText(
        'https://api.linuxserver.io/api/v1/images',
        'json',
        10,
        excessive
      )
    ).rejects.toMatchObject({ code: 'RESOURCE_LIMIT' });
    const redirect = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('', {
        status: 302,
        headers: { Location: 'http://127.0.0.1/' }
      })
    );
    await expect(
      fetchImages(redirect, new MemoryCache())
    ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    const unavailable = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('sensitive-runtime-detail'));
    await expect(
      fetchImages(unavailable, new MemoryCache())
    ).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      message: expect.not.stringContaining('sensitive-runtime-detail')
    });
  });

  it('uses the structured API for official lookups, not HTML or docs-page existence', async () => {
    vi.resetModules();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) =>
      String(url).startsWith('https://api.linuxserver.io/')
        ? Response.json([{ name: 'sonarr' }])
        : new Response('PUID PGID /config Docker Compose', {
            headers: { 'Content-Type': 'text/html' }
          })
    );
    vi.stubGlobal('fetch', fetcher);
    const { lookupOfficialLsioImage } =
      await import('../authoring/image-audit.js');
    const found = await lookupOfficialLsioImage('sonarr');
    expect(found.exists).toBe(true);
    expect(
      fetcher.mock.calls.every(
        ([url]) => !String(url).startsWith('https://www.linuxserver.io/')
      )
    ).toBe(true);
    const absent = await lookupOfficialLsioImage('unlisted');
    expect(absent.exists).toBe(false);
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).includes('docker-unlisted')
      )
    ).toBe(false);
  });
});
