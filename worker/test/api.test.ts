import { describe, expect, it } from 'vitest';
import { app } from '../src/index.js';

describe('public API validation', () => {
  it('rejects an invalid image search limit', async () => {
    const response = await app.request('/api/images?limit=not-a-number');
    expect(response.status).toBe(400);
    expect(((await response.json()) as any).error).toBe('Invalid request');
  });

  it('rejects an unknown request status', async () => {
    const response = await app.request('/api/image-requests?status=pending');
    expect(response.status).toBe(400);
  });

  it('rejects malformed boolean query values', async () => {
    const response = await app.request('/api/known-issues?includeStatus=maybe');
    expect(response.status).toBe(400);
  });
});
