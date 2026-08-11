import { describe, expect, it } from 'vitest';
import { app } from '../src/index.js';

const headers = {
  Accept: 'application/json, text/event-stream',
  'Content-Type': 'application/json'
};

const call = async (body: unknown) =>
  app.request('/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

describe.sequential('MCP Streamable HTTP transport', () => {
  it('initializes, lists every tool, and calls a tool through the SDK transport', async () => {
    const initialize = await call({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'worker-test', version: '1.0.0' }
      }
    });
    expect(initialize.status).toBe(200);
    expect(((await initialize.json()) as any).result.serverInfo.name).toBe(
      'io.github.blackoutsecure/linuxserver-mcp-registry'
    );

    const tools = await call({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const toolsBody = (await tools.json()) as any;
    expect(tools.status).toBe(200);
    expect(toolsBody.result.tools).toHaveLength(13);
    expect(toolsBody.result.tools.map((tool: any) => tool.name)).toContain(
      'lsio.closed_image_requests'
    );

    const support = await call({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'lsio.get_support_links',
        arguments: { context: 'all' }
      }
    });
    const supportBody = (await support.json()) as any;
    expect(support.status).toBe(200);
    expect(supportBody.result.structuredContent.links).toHaveLength(10);
  });
});
