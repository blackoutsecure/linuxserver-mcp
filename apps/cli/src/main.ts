#!/usr/bin/env node
import metadata from '@blackoutsecure/linuxserver-mcp/package.json' with { type: 'json' };
import { errorResult, runCli } from './index.js';

const args = process.argv.slice(2);
if (args.length === 0 || (args.length === 1 && args[0] === 'stdio')) {
  try {
    const { startStdio } =
      await import('@blackoutsecure/linuxserver-mcp/stdio');
    await startStdio();
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: errorResult(error) })}\n`);
    process.exitCode = 2;
  }
} else {
  process.exitCode = await runCli(
    args,
    {
      stdout: (text) => {
        process.stdout.write(text);
      },
      stderr: (text) => {
        process.stderr.write(text);
      }
    },
    metadata.version
  );
}
