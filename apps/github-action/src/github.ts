import { z } from 'zod';
import {
  AnalysisError,
  LIMITS,
  repositoryPathSchema
} from '@blackoutsecure/linuxserver-mcp/core';

const sha = z.string().regex(/^[a-f0-9]{40}$/i);
const slug = z
  .string()
  .regex(/^[A-Za-z0-9_.-]{1,100}$/)
  .refine((value) => value !== '.' && value !== '..');
export const pullRequestEventSchema = z.object({
  number: z.number().int().positive(),
  repository: z.object({ name: slug, owner: z.object({ login: slug }) }),
  pull_request: z.object({ head: z.object({ sha }), base: z.object({ sha }) })
});
const pullSchema = z.object({
  head: z.object({ sha }),
  base: z.object({ sha }),
  changed_files: z.number().int().nonnegative()
});
const changedFileSchema = z
  .array(
    z.object({
      filename: repositoryPathSchema,
      previous_filename: repositoryPathSchema.optional()
    })
  )
  .max(100);

async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.includes('json')) {
    throw new AnalysisError(
      'UPSTREAM_UNAVAILABLE',
      'GitHub returned an unexpected content type.'
    );
  }
  const reader = response.body?.getReader();
  if (!reader)
    throw new AnalysisError(
      'UPSTREAM_UNAVAILABLE',
      'GitHub returned an empty response.'
    );
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_000_000) {
        await reader.cancel();
        throw new AnalysisError(
          'RESOURCE_LIMIT',
          'GitHub response exceeds the byte limit.'
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(merged)) as unknown;
  } catch {
    throw new AnalysisError(
      'UPSTREAM_UNAVAILABLE',
      'GitHub returned malformed JSON.'
    );
  }
}

export async function readChangedFiles(
  eventInput: unknown,
  token?: string,
  fetcher: typeof fetch = fetch
): Promise<string[]> {
  const validated = pullRequestEventSchema.safeParse(eventInput);
  if (!validated.success)
    throw new AnalysisError(
      'VALIDATION_FAILED',
      'The workflow event is not a supported pull_request snapshot.'
    );
  const event = validated.data;
  const base = `https://api.github.com/repos/${event.repository.owner.login}/${event.repository.name}/pulls/${event.number}`;
  const request = async (url: string) => {
    try {
      const response = await fetcher(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(8_000),
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'linuxserver-mcp',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (response.status === 401)
        throw new AnalysisError(
          'AUTH_REQUIRED',
          'GitHub requires a valid read credential for this pull request.'
        );
      if (
        response.status === 429 ||
        (response.status === 403 &&
          response.headers.get('x-ratelimit-remaining') === '0')
      ) {
        throw new AnalysisError(
          'RATE_LIMITED',
          'GitHub read rate limit reached. Retry after the rate-limit reset.'
        );
      }
      if (!response.ok)
        throw new AnalysisError(
          'UPSTREAM_UNAVAILABLE',
          'GitHub could not read this pull request. Verify repository access and retry.'
        );
      return await readJson(response);
    } catch (error) {
      if (error instanceof AnalysisError) throw error;
      throw new AnalysisError(
        'UPSTREAM_UNAVAILABLE',
        'GitHub read failed or timed out. No write was attempted.'
      );
    }
  };
  const before = pullSchema.safeParse(await request(base));
  if (!before.success)
    throw new AnalysisError(
      'UPSTREAM_UNAVAILABLE',
      'GitHub returned invalid pull-request metadata.'
    );
  const matchesEvent = (pull: z.infer<typeof pullSchema>) =>
    pull.head.sha === event.pull_request.head.sha &&
    pull.base.sha === event.pull_request.base.sha;
  if (!matchesEvent(before.data))
    throw new AnalysisError(
      'VALIDATION_FAILED',
      'The pull request changed since this workflow event. Rerun against its current revision.'
    );
  if (before.data.changed_files > LIMITS.changedFiles)
    throw new AnalysisError(
      'RESOURCE_LIMIT',
      'Pull request exceeds the changed-file limit; use a bounded local audit.'
    );
  const paths = new Set<string>();
  let received = 0;
  for (
    let page = 1;
    received < before.data.changed_files && page <= 5;
    page++
  ) {
    const parsed = changedFileSchema.safeParse(
      await request(`${base}/files?per_page=100&page=${page}`)
    );
    if (!parsed.success || parsed.data.length === 0)
      throw new AnalysisError(
        'UPSTREAM_UNAVAILABLE',
        'GitHub returned incomplete changed-file metadata.'
      );
    received += parsed.data.length;
    for (const item of parsed.data) {
      paths.add(item.filename);
      if (item.previous_filename) paths.add(item.previous_filename);
    }
  }
  const after = pullSchema.safeParse(await request(base));
  if (
    !after.success ||
    !matchesEvent(after.data) ||
    after.data.changed_files !== received
  ) {
    throw new AnalysisError(
      'VALIDATION_FAILED',
      'Pull-request metadata changed or was incomplete during review. Rerun against its current revision.'
    );
  }
  if (paths.size > LIMITS.changedFiles)
    throw new AnalysisError(
      'RESOURCE_LIMIT',
      'Renamed and changed paths exceed the review limit.'
    );
  return [...paths].sort();
}
