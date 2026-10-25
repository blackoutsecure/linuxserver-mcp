import { execFileSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli, loadRepository } from '../apps/cli/src/index.js';
import {
  auditRepository,
  LIMITS,
  toSarif
} from '../packages/mcp-server/src/core/index.js';
import { normalApplication } from './fixtures/repositories.js';

const owned: string[] = [];
const create = async () => {
  const root = await mkdtemp(join(tmpdir(), 'linuxserver-cli-test-'));
  owned.push(root);
  return root;
};
const write = async (root: string, path: string, content: string) => {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
};
const call = async (args: string[]) => {
  let stdout = '';
  let stderr = '';
  const code = await runCli(
    args,
    {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      }
    },
    '0.2.0'
  );
  return { code, stdout, stderr };
};
afterEach(async () => {
  for (const path of owned.splice(0))
    await rm(path, { recursive: true, force: true });
});

describe('local CLI adapter', () => {
  it('produces the same deterministic JSON as the shared core', async () => {
    const root = await create();
    for (const file of normalApplication.files)
      await write(root, file.path, file.content);
    const snapshot = await loadRepository(root);
    const result = await call(['audit', root, '--format', 'json']);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual(auditRepository(snapshot));
  }, 20_000);

  it('renders text, workflow annotations and SARIF without using MCP or the network', async () => {
    const root = await create();
    await write(root, 'Dockerfile', 'FROM scratch\nRUN chmod 777 /app\n');
    const text = await call(['audit', root]);
    expect(text.stdout).toContain('CONTAINER-SECURITY-001 Dockerfile:2');
    expect(text.code).toBe(0);
    const github = await call(['audit', root, '--format', 'github']);
    expect(github.stdout).toContain('::warning file=Dockerfile,line=2');
    const output = join(root, 'report.sarif');
    const sarif = await call([
      'audit',
      root,
      '--format',
      'sarif',
      '--output',
      output,
      '--fail-on',
      'warning'
    ]);
    expect(sarif.code).toBe(1);
    expect(sarif.stdout).toBe('');
    expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(
      toSarif(auditRepository(await loadRepository(root)))
    );
    const overwrite = await call(['audit', root, '--output', output]);
    expect(overwrite.code).toBe(2);
    expect(overwrite.stderr).toContain('already exists');
  });

  it('supports explicit changed-file review and configuration thresholds', async () => {
    const root = await create();
    await write(root, 'Dockerfile', 'FROM scratch\nRUN chmod 777 /app\n');
    await write(
      root,
      '.github/linuxserver-mcp.yml',
      'version: 1\nseverity:\n  fail_on: [warning]\n'
    );
    expect((await call(['audit', root])).code).toBe(1);
    const paths = join(root, 'paths.json');
    await write(root, 'paths.json', '["README.md"]');
    expect((await call(['review', root, '--changed-files', paths])).code).toBe(
      0
    );
    expect((await call(['review', root])).code).toBe(2);
    expect((await call(['audit', root, '--fail-on', 'none'])).code).toBe(0);
  });

  it.each([
    ['--format', 'xml'],
    ['--fail-on', 'maybe'],
    ['--policy', 'official'],
    ['--unknown']
  ])('rejects invalid CLI arguments %s', async (...args) => {
    expect((await call(['audit', '.', ...args])).code).toBe(2);
  });

  it('shows help/version and starts the built canonical CLI with explicit audit arguments', async () => {
    expect((await call(['--help'])).stdout).toContain('audit [directory]');
    expect((await call(['--version'])).stdout).toBe('0.2.0\n');
    const root = await create();
    await write(root, 'Dockerfile', 'FROM scratch\n');
    const command = fileURLToPath(
      new URL('../packages/mcp-server/dist/command.js', import.meta.url)
    );
    const result = execFileSync(
      process.execPath,
      [command, 'audit', root, '--format', 'json'],
      {
        encoding: 'utf8',
        timeout: 10_000,
        windowsHide: false
      }
    );
    expect(JSON.parse(result).policyVersion).toBe('1.0.0');
  });
});

describe('bounded repository reading', () => {
  it('does not traverse irrelevant directories or execute repository contents', async () => {
    const root = await create();
    await write(
      root,
      'Dockerfile',
      'FROM scratch\nRUN touch should-not-exist\n'
    );
    await write(
      root,
      'node_modules/large-file',
      'x'.repeat(LIMITS.fileBytes + 1)
    );
    await write(root, '.env', 'TOKEN=not-a-real-secret');
    const result = await loadRepository(root);
    expect(result.files.map((file) => file.path)).toEqual(['Dockerfile']);
    await expect(
      readFile(join(root, 'should-not-exist'))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects a relevant symlink/junction rather than reading outside the target', async () => {
    const root = await create();
    const outside = await create();
    await write(outside, 'etc/s6-overlay/s6-rc.d/app/type', 'longrun');
    await symlink(
      outside,
      join(root, 'root'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    await expect(loadRepository(root)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
  });

  it('enforces file byte limits and malformed changed-path input', async () => {
    const root = await create();
    await write(root, 'Dockerfile', 'x'.repeat(LIMITS.fileBytes + 1));
    await expect(loadRepository(root)).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT'
    });
    await write(root, 'paths.json', '["../outside"]');
    expect(
      (
        await call([
          'review',
          root,
          '--changed-files',
          join(root, 'paths.json')
        ])
      ).code
    ).toBe(2);
  });
});
