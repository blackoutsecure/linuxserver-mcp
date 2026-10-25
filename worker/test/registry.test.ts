import { describe, expect, it } from 'vitest';
import { app } from '../src/index.js';

describe('Worker registry', () => {
  it('returns health', async () =>
    expect(await (await app.request('/health')).text()).toBe('OK'));

  it('lists registry servers with CORS headers', async () => {
    const response = await app.request('/v0.1/servers');
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(((await response.json()) as any).servers[0].name).toBe(
      'io.github.blackoutsecure/linuxserver-mcp'
    );
  });

  it('returns latest and specific server metadata', async () => {
    const encoded = encodeURIComponent(
      'io.github.blackoutsecure/linuxserver-mcp'
    );
    expect(
      (await app.request(`/v0.1/servers/${encoded}/versions/latest`)).status
    ).toBe(200);
    expect(
      (await app.request(`/v0.1/servers/${encoded}/versions/0.2.0`)).status
    ).toBe(200);
    expect(
      (await app.request(`/v0.1/servers/${encoded}/versions/9.9.9`)).status
    ).toBe(404);
  });

  it('handles registry preflight', async () => {
    const response = await app.request('/v0.1/servers', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'GET'
      }
    });
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
      'GET'
    );
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
      'Authorization'
    );
  });
});
