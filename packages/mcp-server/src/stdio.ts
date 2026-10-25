import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createMcpServer } from './mcp/server.js';

export async function startStdio(): Promise<void> {
  await createMcpServer().connect(new StdioServerTransport());
}
