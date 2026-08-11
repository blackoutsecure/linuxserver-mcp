#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createMcpServer } from './mcp/server.js';

export * from './constants.js';
export * from './registry/server-json.js';
export * from './registry/v01.js';
export * from './schemas/tool-inputs.js';
export * from './services/cache.js';
export * from './tools.js';
export * from './types.js';
export { createMcpServer } from './mcp/server.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
}
