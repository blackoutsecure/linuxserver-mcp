import { appendFile, mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import {
  AnalysisError,
  auditRepository,
  escapeCommandData,
  hasFailures,
  parseSnapshot,
  profileSchema,
  toGithubAnnotations,
  toSarif,
  toText
} from '@blackoutsecure/linuxserver-mcp/core';
import {
  errorResult,
  isWithin,
  loadRepository,
  readBoundedFile,
  threshold
} from '@blackoutsecure/linuxserver-mcp-cli';
import { readChangedFiles } from './github.js';

type Environment = Record<string, string | undefined>;
const input = (env: Environment, name: string) =>
  env[`INPUT_${name.toUpperCase()}`]?.trim();
const html = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function runAction(
  env: Environment,
  stdout: (value: string) => void,
  fetcher: typeof fetch = fetch
): Promise<number> {
  try {
    if (env.GITHUB_EVENT_NAME === 'pull_request_target') {
      throw new AnalysisError(
        'VALIDATION_FAILED',
        'Use pull_request, not pull_request_target, for untrusted repository review.'
      );
    }
    const workspace = env.GITHUB_WORKSPACE;
    const temp = env.RUNNER_TEMP;
    if (!workspace || !temp || /[\r\n]/.test(workspace + temp)) {
      throw new AnalysisError(
        'VALIDATION_FAILED',
        'GITHUB_WORKSPACE and RUNNER_TEMP must be valid runner paths.'
      );
    }
    const path = resolve(workspace, input(env, 'path') || '.');
    if (!isWithin(resolve(workspace), path))
      throw new AnalysisError(
        'VALIDATION_FAILED',
        'The Action audit path must remain inside GITHUB_WORKSPACE.'
      );
    if (!isWithin(await realpath(workspace), await realpath(path)))
      throw new AnalysisError(
        'VALIDATION_FAILED',
        'The Action target resolves outside GITHUB_WORKSPACE.'
      );
    const sourcePrefix = relative(resolve(workspace), path)
      .split(sep)
      .join('/');
    const mode = input(env, 'mode') || 'review';
    if (mode !== 'audit' && mode !== 'review')
      throw new AnalysisError(
        'VALIDATION_FAILED',
        'Action mode must be audit or review. No mutation mode is implemented.'
      );
    const annotate = input(env, 'annotate') || 'true';
    if (!['true', 'false'].includes(annotate))
      throw new AnalysisError(
        'VALIDATION_FAILED',
        'annotate must be true or false.'
      );
    const policy = input(env, 'policy');
    const profile = policy ? profileSchema.safeParse(policy) : undefined;
    if (profile && !profile.success)
      throw new AnalysisError(
        'VALIDATION_FAILED',
        'Unknown Action policy profile.'
      );
    const failOn = threshold(input(env, 'fail-on'));
    let changedFiles: string[] | undefined;
    if (mode === 'review') {
      const supplied = input(env, 'changed-files');
      if (supplied) {
        if (Buffer.byteLength(supplied) > 64_000)
          throw new AnalysisError(
            'RESOURCE_LIMIT',
            'Changed-file input is too large.'
          );
        let value: unknown;
        try {
          value = JSON.parse(supplied) as unknown;
        } catch {
          throw new AnalysisError(
            'VALIDATION_FAILED',
            'changed-files must be a JSON array of relative repository paths.'
          );
        }
        changedFiles = parseSnapshot({
          files: [],
          changedFiles: value
        }).changedFiles;
      } else {
        if (
          env.GITHUB_EVENT_NAME !== 'pull_request' ||
          !env.GITHUB_EVENT_PATH
        ) {
          throw new AnalysisError(
            'VALIDATION_FAILED',
            'review requires a pull_request event or explicit changed-files JSON.'
          );
        }
        const event = await readBoundedFile(env.GITHUB_EVENT_PATH, 256_000);
        let value: unknown;
        try {
          value = JSON.parse(event) as unknown;
        } catch {
          throw new AnalysisError(
            'VALIDATION_FAILED',
            'The workflow event is not valid JSON.'
          );
        }
        changedFiles = await readChangedFiles(
          value,
          input(env, 'token'),
          fetcher
        );
      }
    }
    if (sourcePrefix && changedFiles) {
      changedFiles = changedFiles
        .filter((file) => file.startsWith(`${sourcePrefix}/`))
        .map((file) => file.slice(sourcePrefix.length + 1));
    }
    const report = auditRepository(
      await loadRepository(path, {
        changedFiles,
        profile: profile?.success ? profile.data : undefined
      })
    );
    const output = await mkdtemp(join(temp, 'linuxserver-mcp-'));
    const sarifPath = join(output, 'linuxserver-mcp.sarif');
    await writeFile(
      sarifPath,
      `${JSON.stringify(toSarif(report, sourcePrefix), null, 2)}\n`,
      { flag: 'wx' }
    );
    await writeFile(
      join(output, 'report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      { flag: 'wx' }
    );
    if (annotate === 'true' && report.config.github.annotations) {
      const annotations = toGithubAnnotations(report, sourcePrefix);
      if (annotations) stdout(`${annotations}\n`);
    }
    stdout(
      `LinuxServer MCP ${mode}: ${report.findings.length} findings, ${report.suppressedFindings.length} suppressed (${report.status}).\n`
    );
    const failed = hasFailures(report, failOn);
    if (env.GITHUB_OUTPUT) {
      await appendFile(
        env.GITHUB_OUTPUT,
        `sarif-file=${sarifPath}\nfindings=${report.findings.length}\nfailed=${failed}\n`
      );
    }
    if (env.GITHUB_STEP_SUMMARY && report.config.github.summary) {
      await appendFile(
        env.GITHUB_STEP_SUMMARY,
        `## LinuxServer MCP Review\n\n<pre>${html(toText(report))}</pre>\n`
      );
    }
    return failed ? 1 : 0;
  } catch (error) {
    const detail = errorResult(error);
    stdout(
      `::error title=LinuxServer MCP::${escapeCommandData(`${detail.code}: ${detail.message}`)}\n`
    );
    return 2;
  }
}
