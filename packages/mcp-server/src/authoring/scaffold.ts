/**
 * LinuxServer.io MCP Server
 * Module: Orchestration of validation and scaffold artifact generation
 * Standards basis: LSIO repo-layout and starter-artifact expectations
 * Approval status: Community-aligned implementation; verify with LSIO maintainers for official acceptance
 */
import {
  renderComposeSnippet,
  renderDockerfile,
  renderReadmeSnippet
} from './templates.js';
import type { ScaffoldOutput, ServiceSpec } from './types.js';
import { validateLsioSpec } from './validation.js';

export function scaffoldLsioService(spec: ServiceSpec): ScaffoldOutput {
  const validation = validateLsioSpec(spec);
  if (!validation.valid) {
    throw new Error(
      `Invalid spec: ${validation.issues.map((issue) => issue.message).join('; ')}`
    );
  }

  return {
    dockerfile: renderDockerfile(spec),
    readmeSnippet: renderReadmeSnippet(spec),
    composeSnippet: renderComposeSnippet(spec),
    directories: ['/config', '/app', '/defaults', 'root/']
  };
}
