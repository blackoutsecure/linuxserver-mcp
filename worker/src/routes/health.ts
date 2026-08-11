import { Hono } from 'hono';
export const healthRoutes = new Hono().get('/health', (context) =>
  context.text('OK')
);
