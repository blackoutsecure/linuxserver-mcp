#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createMcpServer } from './mcp/server.js';

await createMcpServer().connect(new StdioServerTransport());
