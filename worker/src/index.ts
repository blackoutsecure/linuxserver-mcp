import {
  configureExternalCache,
  type ExternalCache
} from '@blackoutsecure/linuxserver-mcp';
import { Hono } from 'hono';
import { ZodError } from 'zod';
import { apiRoutes } from './routes/api.js';
import { healthRoutes } from './routes/health.js';
import { mcpRoutes } from './routes/mcp.js';
import { registryRoutes } from './routes/registry.js';

export const app = new Hono();
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
app.onError((error, context) =>
  error instanceof ZodError
    ? context.json({ error: 'Invalid request', issues: error.issues }, 400)
    : context.json({ error: 'Request failed' }, 500)
);

export default app;
