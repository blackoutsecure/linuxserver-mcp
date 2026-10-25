import { execFileSync } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAction } from '../apps/github-action/src/index.js';
import { readChangedFiles } from '../apps/github-action/src/github.js';

const owned: string[] = [];
const create = async () => {
  const root = await mkdtemp(join(tmpdir(), 'linuxserver-action-test-'));
  owned.push(root);
  return root;
};
const write = async (root: string, path: string, content: string) => {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content);
};
afterEach(async () => {
  for (const path of owned.splice(0))
    await rm(path, { recursive: true, force: true });
});
const event = {
  number: 12,
  repository: { name: 'container', owner: { login: 'example' } },
  pull_request: { head: { sha: 'a'.repeat(40) }, base: { sha: 'b'.repeat(40) } }
};
const pull = { ...event.pull_request, changed_files: 1 };

describe('bounded GitHub read adapter', () => {
  it('only uses GET on the fixed GitHub API, verifies revisions and includes rename sources', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(pull))
      .mockResolvedValueOnce(
        Response.json([
          { filename: 'Dockerfile', previous_filename: 'Dockerfile.old' }
        ])
      )
      .mockResolvedValueOnce(Response.json(pull));
    expect(await readChangedFiles(event, 'not-a-real-token', fetcher)).toEqual([
      'Dockerfile',
      'Dockerfile.old'
    ]);
    for (const [url, options] of fetcher.mock.calls) {
      expect(String(url)).toMatch(
        /^https:\/\/api\.github\.com\/repos\/example\/container\/pulls\/12/
      );
      expect(options?.method).toBe('GET');
      expect(options?.redirect).toBe('error');
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('rejects changed revisions, truncated lists and excessive pagination instead of reviewing stale data', async () => {
    const changed = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        ...pull,
        head: { sha: 'c'.repeat(40) }
      })
    );
    await expect(
      readChangedFiles(event, undefined, changed)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    const excessive = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ...pull, changed_files: 501 }));
    await expect(
      readChangedFiles(event, undefined, excessive)
    ).rejects.toMatchObject({ code: 'RESOURCE_LIMIT' });
    const missing = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(pull))
      .mockResolvedValueOnce(Response.json([]));
    await expect(
      readChangedFiles(event, undefined, missing)
    ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it.each([
    [401, {}, 'AUTH_REQUIRED'],
    [429, {}, 'RATE_LIMITED'],
    [403, { 'x-ratelimit-remaining': '0' }, 'RATE_LIMITED'],
    [500, {}, 'UPSTREAM_UNAVAILABLE']
  ])(
    'returns a structured failure for status %s',
    async (status, headers, code) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response('', { status: Number(status), headers })
        );
      await expect(
        readChangedFiles(event, undefined, fetcher)
      ).rejects.toMatchObject({ code });
    }
  );

  it('rejects malformed fields, unexpected bodies and unsafe changed paths', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(pull))
      .mockResolvedValueOnce(Response.json([{ filename: '../outside' }]));
    await expect(
      readChangedFiles(event, undefined, fetcher)
    ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    const html = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('<html>not JSON</html>'));
    await expect(
      readChangedFiles(event, undefined, html)
    ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });
});

describe('read-only GitHub Action', () => {
  it('creates SARIF/JSON and annotations using the core, with no network or repository mutation', async () => {
    const root = await create();
    const temp = await create();
    const source = 'FROM scratch\nRUN chmod 777 /app\n';
    await write(root, 'Dockerfile', source);
    const outputPath = join(temp, 'outputs');
    const summary = join(temp, 'summary');
    let output = '';
    const fetcher = vi.fn<typeof fetch>();
    const result = await runAction(
      {
        GITHUB_WORKSPACE: root,
        RUNNER_TEMP: temp,
        GITHUB_OUTPUT: outputPath,
        GITHUB_STEP_SUMMARY: summary,
        INPUT_MODE: 'audit',
        'INPUT_FAIL-ON': 'warning'
      },
      (text) => {
        output += text;
      },
      fetcher
    );
    expect(result).toBe(1);
    expect(output).toContain('::warning file=Dockerfile,line=2');
    expect(fetcher).not.toHaveBeenCalled();
    expect(await readFile(join(root, 'Dockerfile'), 'utf8')).toBe(source);
    const outputs = await readFile(outputPath, 'utf8');
    const sarifPath = outputs
      .split('\n')
      .find((line) => line.startsWith('sarif-file='))
      ?.slice('sarif-file='.length);
    expect(sarifPath).toBeDefined();
    expect(
      JSON.parse(await readFile(sarifPath ?? '', 'utf8')).runs[0].results[0]
        .ruleId
    ).toBe('CONTAINER-SECURITY-001');
    expect(await readFile(summary, 'utf8')).toContain('LinuxServer MCP Review');
  });

  it('limits subdirectory reviews while preserving workspace-relative annotation/SARIF paths', async () => {
    const root = await create();
    const temp = await create();
    await write(
      root,
      'containers/test/Dockerfile',
      'FROM scratch\nRUN chmod 777 /app\n'
    );
    let output = '';
    const code = await runAction(
      {
        GITHUB_WORKSPACE: root,
        RUNNER_TEMP: temp,
        INPUT_PATH: 'containers/test',
        INPUT_MODE: 'review',
        'INPUT_CHANGED-FILES': '["containers/test/Dockerfile"]',
        'INPUT_FAIL-ON': 'warning'
      },
      (text) => {
        output += text;
      }
    );
    expect(code).toBe(1);
    expect(output).toContain('file=containers/test/Dockerfile,line=2');
  });

  it('respects repository thresholds, profiles and annotation configuration', async () => {
    const root = await create();
    const temp = await create();
    await write(root, 'Dockerfile', 'FROM scratch\nRUN chmod 777 /app\n');
    await write(
      root,
      '.github/linuxserver-mcp.yml',
      'version: 1\npolicy:\n  profile: linuxserver\ngithub:\n  annotations: false\n'
    );
    let output = '';
    const code = await runAction(
      {
        GITHUB_WORKSPACE: root,
        RUNNER_TEMP: temp,
        INPUT_MODE: 'audit'
      },
      (text) => {
        output += text;
      }
    );
    expect(code).toBe(0);
    expect(output).not.toContain('::warning');
    expect(output).toContain('0 findings');
  });

  it.each([
    { INPUT_MODE: 'fix' },
    { INPUT_PATH: '..', INPUT_MODE: 'audit' },
    { GITHUB_EVENT_NAME: 'pull_request_target', INPUT_MODE: 'audit' },
    { INPUT_MODE: 'review' },
    { INPUT_MODE: 'audit', INPUT_ANNOTATE: 'maybe' }
  ])(
    'fails closed for unsupported modes, paths and contexts',
    async (override) => {
      const root = await create();
      const temp = await create();
      let output = '';
      const code = await runAction(
        { GITHUB_WORKSPACE: root, RUNNER_TEMP: temp, ...override },
        (text) => {
          output += text;
        }
      );
      expect(code).toBe(2);
      expect(output).toContain('VALIDATION_FAILED');
      expect(output).not.toContain('stack');
    }
  );

  it('runs the shipped standalone bundle without installing dependencies in the target repository', async () => {
    const root = await create();
    const temp = await create();
    await write(root, 'Dockerfile', 'FROM scratch\n');
    const artifact = fileURLToPath(
      new URL('../apps/github-action/dist/index.cjs', import.meta.url)
    );
    const standalone = join(temp, 'action.cjs');
    await copyFile(artifact, standalone);
    const output = execFileSync(process.execPath, [standalone], {
      encoding: 'utf8',
      timeout: 10_000,
      windowsHide: false,
      env: {
        ...process.env,
        GITHUB_WORKSPACE: root,
        RUNNER_TEMP: temp,
        GITHUB_EVENT_NAME: 'push',
        GITHUB_OUTPUT: join(temp, 'outputs'),
        GITHUB_STEP_SUMMARY: join(temp, 'summary'),
        INPUT_MODE: 'audit'
      }
    });
    expect(output).toContain('0 findings');
    const notices = await readFile(
      fileURLToPath(
        new URL(
          '../apps/github-action/dist/THIRD_PARTY_LICENSES.txt',
          import.meta.url
        )
      ),
      'utf8'
    );
    expect(notices).toContain('Copyright Eemeli Aro');
    expect(notices).toContain('Colin McDonnell');
  });
});
