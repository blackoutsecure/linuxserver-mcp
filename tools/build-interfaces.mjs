import { build } from 'esbuild';
import { fileURLToPath, URL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { argv } from 'node:process';

const root = fileURLToPath(new URL('../', import.meta.url));
const cliOnly = argv.includes('--cli-only');
const actionOnly = argv.includes('--action-only');
if (!actionOnly) {
  await build({
    absWorkingDir: root,
    entryPoints: ['apps/cli/src/main.ts'],
    outfile: 'packages/mcp-server/dist/command.js',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    packages: 'external',
    legalComments: 'inline'
  });
}
if (!cliOnly) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: ['apps/github-action/src/main.ts'],
    outfile: 'apps/github-action/dist/index.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    // Preserve dependency template whitespace without trailing spaces in the checked-in bundle.
    supported: { 'template-literal': false },
    legalComments: 'inline',
    metafile: true,
    banner: {
      js: '// LinuxServer MCP - GPL-3.0; see LICENSE, NOTICE, and THIRD_PARTY_LICENSES.txt.'
    }
  });
  const dependencies = new Set(
    Object.keys(result.metafile.inputs).flatMap((path) => {
      const match = /^node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(path);
      return match ? [match[1]] : [];
    })
  );
  const notices = [];
  for (const dependency of [...dependencies].sort()) {
    if (!['yaml', 'zod'].includes(dependency)) {
      throw new Error(
        `Add the bundled dependency license notice for ${dependency}.`
      );
    }
    const manifest = JSON.parse(
      await readFile(
        resolve(root, 'node_modules', dependency, 'package.json'),
        'utf8'
      )
    );
    const license = await readFile(
      resolve(root, 'node_modules', dependency, 'LICENSE'),
      'utf8'
    );
    notices.push(
      `${dependency}@${manifest.version} (${manifest.license})\n\n${license.trim()}`
    );
  }
  await writeFile(
    resolve(root, 'apps/github-action/dist/THIRD_PARTY_LICENSES.txt'),
    `${notices.join('\n\n----------------------------------------\n\n')}\n`,
    'utf8'
  );
}
