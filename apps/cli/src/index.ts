import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  AnalysisError,
  auditRepository,
  formatReport,
  hasFailures,
  LIMITS,
  outputFormatSchema,
  parseSnapshot,
  profileSchema,
  severitySchema,
  type Severity
} from '@blackoutsecure/linuxserver-mcp/core';
import { loadRepository, readBoundedFile } from './repository.js';

export { loadRepository, readBoundedFile, isWithin } from './repository.js';
export const HELP = `linuxserver-mcp - community LinuxServer.io repository analysis

Usage:
  linuxserver-mcp                         Start the MCP stdio server
  linuxserver-mcp stdio                   Start the MCP stdio server
  linuxserver-mcp audit [directory]        Audit local container sources
  linuxserver-mcp review [directory] --changed-files paths.json

Options:
  --format text|json|github|sarif          Output format (default: text)
  --output path                          Create a report; never overwrite
  --policy recommended|linuxserver|security
  --fail-on error|warning|info|none        Override the repository threshold
  --changed-files path                   JSON array of relative changed paths
  --help                                Show this help
  --version                             Show the package version

Repository configuration: .github/linuxserver-mcp.yml (version: 1).
Read-only analysis: files are never executed, changed, or followed as symlinks.
Exit codes: 0 complete, 1 configured finding threshold, 2 input/runtime error.
`;

export function threshold(value: string | undefined): Severity[] | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === 'none') return [];
  const parsed = severitySchema.safeParse(value);
  if (!parsed.success)
    throw new AnalysisError(
      'VALIDATION_FAILED',
      'fail-on must be error, warning, info, or none.'
    );
  const levels: Severity[] = ['error', 'warning', 'info'];
  return levels.slice(0, levels.indexOf(parsed.data) + 1);
}

export function errorResult(error: unknown): { code: string; message: string } {
  if (error instanceof AnalysisError)
    return { code: error.code, message: error.message };
  if (error instanceof Error && 'code' in error) {
    if (error.code === 'ENOENT')
      return {
        code: 'NOT_FOUND',
        message: 'A required directory or file was not found.'
      };
    if (error.code === 'EEXIST')
      return {
        code: 'VALIDATION_FAILED',
        message:
          'The report destination already exists. Choose a new output path.'
      };
    if (error.code === 'EACCES' || error.code === 'EPERM')
      return {
        code: 'VALIDATION_FAILED',
        message:
          'A required path is not accessible with the current permissions.'
      };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: 'Analysis failed unexpectedly. No repository changes were applied.'
  };
}

export async function runCli(
  args: string[],
  io: { stdout: (text: string) => void; stderr: (text: string) => void },
  version: string
): Promise<number> {
  try {
    let parsed: ReturnType<typeof parseArgs>;
    try {
      parsed = parseArgs({
        args,
        allowPositionals: true,
        strict: true,
        options: {
          format: { type: 'string' },
          output: { type: 'string' },
          policy: { type: 'string' },
          'fail-on': { type: 'string' },
          'changed-files': { type: 'string' },
          help: { type: 'boolean' },
          version: { type: 'boolean' }
        }
      });
    } catch {
      throw new AnalysisError(
        'VALIDATION_FAILED',
        'Invalid command-line arguments. Run linuxserver-mcp --help.'
      );
    }
    const { values, positionals } = parsed;
    if (values.help) {
      io.stdout(HELP);
      return 0;
    }
    if (values.version) {
      io.stdout(`${version}\n`);
      return 0;
    }
    const command = positionals[0];
    if (!['audit', 'review'].includes(command) || positionals.length > 2) {
      throw new AnalysisError(
        'VALIDATION_FAILED',
        'Use audit or review with at most one repository directory. Run --help for usage.'
      );
    }
    const parsedFormat = outputFormatSchema.safeParse(values.format ?? 'text');
    if (!parsedFormat.success) {
      throw new AnalysisError(
        'VALIDATION_FAILED',
        'format must be text, json, github, or sarif.'
      );
    }
    const format = parsedFormat.data;
    const profile =
      values.policy === undefined
        ? undefined
        : profileSchema.safeParse(values.policy);
    if (profile && !profile.success)
      throw new AnalysisError('VALIDATION_FAILED', 'Unknown policy profile.');
    const failOn = threshold(
      typeof values['fail-on'] === 'string' ? values['fail-on'] : undefined
    );
    let changedFiles: string[] | undefined;
    if (typeof values['changed-files'] === 'string') {
      const content = await readBoundedFile(
        resolve(values['changed-files']),
        64_000
      );
      let input: unknown;
      try {
        input = JSON.parse(content) as unknown;
      } catch {
        throw new AnalysisError(
          'VALIDATION_FAILED',
          'changed-files must contain a JSON array of relative paths.'
        );
      }
      const snapshot = parseSnapshot({ files: [], changedFiles: input });
      changedFiles = snapshot.changedFiles;
      if ((changedFiles?.length ?? 0) > LIMITS.changedFiles)
        throw new AnalysisError('RESOURCE_LIMIT', 'Too many changed paths.');
    }
    if (command === 'review' && changedFiles === undefined) {
      throw new AnalysisError(
        'VALIDATION_FAILED',
        'review requires --changed-files with an explicit JSON path list.'
      );
    }
    const snapshot = await loadRepository(positionals[1] ?? '.', {
      changedFiles,
      profile: profile?.success ? profile.data : undefined
    });
    const report = auditRepository(snapshot);
    const output = `${formatReport(report, format)}\n`;
    if (typeof values.output === 'string') {
      await writeFile(resolve(values.output), output, {
        flag: 'wx',
        encoding: 'utf8'
      });
    } else {
      io.stdout(output);
    }
    return hasFailures(report, failOn) ? 1 : 0;
  } catch (error) {
    io.stderr(`${JSON.stringify({ error: errorResult(error) })}\n`);
    return 2;
  }
}
