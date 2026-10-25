import { afterEach, describe, expect, it, vi } from 'vitest';
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
      'io.github.blackoutsecure/linuxserver-mcp'
    );

    const tools = await call({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const toolsBody = (await tools.json()) as any;
    expect(tools.status).toBe(200);
    expect(toolsBody.result.tools).toHaveLength(22);
    expect(
      toolsBody.result.tools.map((tool: { name: string }) => tool.name)
    ).toContain('lsio.closed_image_requests');

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

  afterEach(() => vi.unstubAllGlobals());

  it('calls every migrated authoring tool through Streamable HTTP', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response(
              '<a href="/images/docker-sonarr/">Sonarr</a> PUID PGID /config docker compose read-only'
            )
          )
        )
    );
    const inputs: [string, Record<string, unknown>, Record<string, unknown>][] =
      [
        ['lsio.validate_spec', { imageName: 'sampleapp' }, { valid: true }],
        [
          'lsio.generate_scaffold',
          { imageName: 'sampleapp' },
          { directories: ['/config', '/app', '/defaults', 'root/'] }
        ],
        [
          'lsio.get_guidance_links',
          { topic: 'permissions' },
          { nonRoot: 'https://docs.linuxserver.io/misc/non-root/' }
        ],
        [
          'lsio.get_best_practices',
          { profile: 'docker' },
          { docker: expect.any(Array) }
        ],
        [
          'lsio.get_skillsets',
          { profile: 'review' },
          { skillsets: [expect.objectContaining({ id: 'review' })] }
        ],
        [
          'lsio.get_optimization_ideas',
          { scope: 'release' },
          { release: expect.any(Array) }
        ],
        [
          'lsio.lookup_official_image',
          { imageName: 'sonarr' },
          { exists: true, imageName: 'sonarr' }
        ],
        [
          'lsio.audit_image_compliance',
          { imageName: 'sampleapp', checkOfficialImage: false },
          { checks: expect.any(Array), remediation: expect.any(Object) }
        ],
        [
          'lsio.generate_dockerfile',
          { imageName: 'sampleapp' },
          {
            fileName: 'Dockerfile',
            validation: expect.objectContaining({ valid: true })
          }
        ]
      ];
    for (const [index, [name, args, expected]] of inputs.entries()) {
      const response = await call({
        jsonrpc: '2.0',
        id: index + 10,
        method: 'tools/call',
        params: { name, arguments: args }
      });
      const body = (await response.json()) as {
        result: {
          isError?: boolean;
          structuredContent: Record<string, unknown>;
        };
      };
      expect(response.status).toBe(200);
      expect(body.result.isError).not.toBe(true);
      expect(body.result.structuredContent).toMatchObject(expected);
    }
  });

  it('preserves validation failures instead of returning successful scaffolds', async () => {
    const response = await call({
      jsonrpc: '2.0',
      id: 30,
      method: 'tools/call',
      params: {
        name: 'lsio.generate_scaffold',
        arguments: { imageName: 'Bad Name' }
      }
    });
    const body = (await response.json()) as {
      result: { isError: boolean; content: { text: string }[] };
    };
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain('Invalid spec');
  });
});
