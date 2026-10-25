import {
  configureExternalCache,
  type ExternalCache
} from '@blackoutsecure/linuxserver-mcp';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { ZodError } from 'zod';
import { AnalysisError } from '@blackoutsecure/linuxserver-mcp/core';
import { apiRoutes } from './routes/api.js';
import { healthRoutes } from './routes/health.js';
import { mcpRoutes } from './routes/mcp.js';
import { registryRoutes } from './routes/registry.js';

export const app = new Hono();
app.use(
  '*',
  bodyLimit({
    maxSize: 3_000_000,
    onError: (context) =>
      context.json(
        {
          error: {
            code: 'RESOURCE_LIMIT',
            message: 'Request body exceeds the 3 MB limit.'
          }
        },
        413
      )
  })
);
app.use('*', async (context, next) => {
  configureExternalCache(
    (context.env as { CACHE?: ExternalCache } | undefined)?.CACHE
  );
  await next();
});
app.route('/', healthRoutes);
app.route('/', apiRoutes);
app.route('/', mcpRoutes);
app.route('/', registryRoutes);
app.onError((error, context) => {
  if (error instanceof ZodError) {
    return context.json(
      { error: 'Invalid request', issues: error.issues },
      400
    );
  }
  if (error instanceof AnalysisError) {
    const status =
      error.code === 'VALIDATION_FAILED'
        ? 400
        : error.code === 'RESOURCE_LIMIT'
          ? 413
          : error.code === 'RATE_LIMITED'
            ? 429
            : 502;
    return context.json(
      { error: { code: error.code, message: error.message } },
      status
    );
  }
  return context.json({ error: 'Request failed' }, 500);
});

export default app;
