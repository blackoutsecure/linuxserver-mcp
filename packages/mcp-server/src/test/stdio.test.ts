import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const expectedTools = [
  'lsio.search_images',
  'lsio.get_image',
  'lsio.audit_image',
  'lsio.audit_compose',
  'lsio.list_categories',
  'lsio.get_known_issues',
  'lsio.search_image_requests',
  'lsio.pending_image_requests',
  'lsio.closed_image_requests',
  'lsio.recommended_new_images',
  'lsio.prepare_image_request',
  'lsio.image_pipeline',
  'lsio.get_support_links',
  'lsio.validate_spec',
  'lsio.generate_scaffold',
  'lsio.get_guidance_links',
  'lsio.get_best_practices',
  'lsio.get_skillsets',
  'lsio.lookup_official_image',
  'lsio.audit_image_compliance',
  'lsio.generate_dockerfile',
  'lsio.get_optimization_ideas',
  'repo_inspect',
  'repo_audit',
  'release_status'
];

type RpcResponse = {
  id: number;
  error?: { code: number; message: string };
  result: {
    serverInfo?: { name: string; version: string };
    tools?: { name: string }[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
};

it.each(['cli.js', 'command.js'])(
  'starts %s without arguments as backwards-compatible MCP stdio',
  async (entry) => {
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL(`../../dist/${entry}`, import.meta.url))],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const reader = createInterface({ input: child.stdout });
    const lines = reader[Symbol.asyncIterator]();
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    const deadline = setTimeout(() => {
      child.kill();
      reader.close();
    }, 8_000);
    const call = async (id: number, method: string, params?: object) => {
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`
      );
      const line = await lines.next();
      if (line.done)
        throw new Error(`Stdio server closed before responding: ${stderr}`);
      const response = JSON.parse(line.value) as RpcResponse;
      expect(response.id).toBe(id);
      expect(response.error).toBeUndefined();
      return response.result;
    };

    try {
      const initialized = await call(1, 'initialize', {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'stdio-test', version: '1.0.0' }
      });
      expect(initialized.serverInfo).toEqual({
        name: 'io.github.blackoutsecure/linuxserver-mcp',
        version: '0.2.0'
      });
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`
      );
      const listed = await call(2, 'tools/list');
      expect(listed.tools?.map(({ name }) => name).sort()).toEqual(
        [...expectedTools].sort()
      );
      const support = await call(3, 'tools/call', {
        name: 'lsio.get_support_links',
        arguments: { context: 'all' }
      });
      expect(support.structuredContent?.links).toHaveLength(10);
      const scaffold = await call(4, 'tools/call', {
        name: 'lsio.generate_scaffold',
        arguments: { imageName: 'sampleapp', appPort: 8080 }
      });
      expect(scaffold.isError).not.toBe(true);
      expect(scaffold.structuredContent?.dockerfile).toContain(
        'FROM lscr.io/linuxserver/baseimage-alpine'
      );
      expect(scaffold.structuredContent?.directories).toEqual([
        '/config',
        '/app',
        '/defaults',
        'root/'
      ]);
      const audited = await call(5, 'tools/call', {
        name: 'repo_audit',
        arguments: {
          files: [
            {
              path: 'Dockerfile',
              content: 'FROM scratch\nRUN chmod 777 /app\n'
            }
          ],
          complete: true
        }
      });
      expect(audited.isError).not.toBe(true);
      expect(audited.structuredContent?.findings).toEqual([
        expect.objectContaining({
          ruleId: 'CONTAINER-SECURITY-001',
          evidenceKind: 'general_security'
        })
      ]);
    } finally {
      clearTimeout(deadline);
      child.stdin.end();
      child.kill();
      reader.close();
    }
  },
  10_000
);
