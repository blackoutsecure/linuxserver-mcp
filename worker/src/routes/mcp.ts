import { createMcpServer } from '@blackoutsecure/linuxserver-mcp-registry';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
import { Hono } from 'hono';
import { apiCors } from '../middleware/cors.js';
import { rateLimit } from '../middleware/rate-limit.js';

const server = createMcpServer();
const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true
});
const connected = server.connect(transport);

export const mcpRoutes = new Hono();
mcpRoutes.use('/mcp', apiCors);
mcpRoutes.use('/mcp', async (context, next) => {
  if (context.req.method === 'POST') return rateLimit(context, next);
  await next();
});
mcpRoutes.all('/mcp', async (context) => {
  await connected;
  return transport.handleRequest(context.req.raw);
});
