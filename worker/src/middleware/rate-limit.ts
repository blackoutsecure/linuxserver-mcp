import type { Context, Next } from 'hono';

const windows = new Map<string, { count: number; reset: number }>();

export async function rateLimit(context: Context, next: Next) {
  const key = context.req.header('CF-Connecting-IP') ?? 'local';
  const now = Date.now();
  const current = windows.get(key);
  const bucket =
    !current || current.reset <= now
      ? { count: 0, reset: now + 60_000 }
      : current;
  bucket.count += 1;
  windows.set(key, bucket);
  context.header('RateLimit-Limit', '30');
  context.header('RateLimit-Remaining', String(Math.max(0, 30 - bucket.count)));
  if (bucket.count > 30)
    return context.json(
      { error: 'Rate limit exceeded. Try again shortly.' },
      429
    );
  await next();
}
