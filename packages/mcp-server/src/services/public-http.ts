import { AnalysisError } from '../core/schemas.js';

export async function fetchPublicText(
  url: string,
  kind: 'json' | 'html',
  maxBytes: number,
  fetcher: typeof fetch = fetch
): Promise<string> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new AnalysisError(
      'VALIDATION_FAILED',
      'An authoritative source URL is invalid.'
    );
  }
  if (
    target.protocol !== 'https:' ||
    target.username ||
    target.password ||
    (target.port && target.port !== '443') ||
    !['api.linuxserver.io', 'docs.linuxserver.io'].includes(target.hostname)
  ) {
    throw new AnalysisError(
      'VALIDATION_FAILED',
      'Only allowlisted HTTPS LinuxServer API/documentation sources may be fetched.'
    );
  }
  try {
    const response = await fetcher(target.href, {
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
      headers: {
        Accept: kind === 'json' ? 'application/json' : 'text/html',
        'User-Agent': 'linuxserver-mcp'
      }
    });
    if (response.status === 429)
      throw new AnalysisError(
        'RATE_LIMITED',
        'The authoritative source is rate limited. Retry later.'
      );
    if (!response.ok)
      throw new AnalysisError(
        'UPSTREAM_UNAVAILABLE',
        'The authoritative source returned an unsuccessful response.'
      );
    const contentType = response.headers.get('content-type') ?? '';
    if (
      !(kind === 'json' ? /(?:application\/json|\+json)/i : /text\/html/i).test(
        contentType
      )
    ) {
      throw new AnalysisError(
        'UPSTREAM_UNAVAILABLE',
        'The authoritative source returned an unexpected content type.'
      );
    }
    const reader = response.body?.getReader();
    if (!reader)
      throw new AnalysisError(
        'UPSTREAM_UNAVAILABLE',
        'The authoritative source returned an empty response.'
      );
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new AnalysisError(
            'RESOURCE_LIMIT',
            'The authoritative response exceeds its byte limit.'
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    throw new AnalysisError(
      'UPSTREAM_UNAVAILABLE',
      'The authoritative source could not be read within its limits. No negative lookup result was inferred.'
    );
  }
}
