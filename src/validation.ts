/**
 * LinuxServer.io MCP Server
 * Module: Rule-based validation for LSIO-oriented service specs
 * Standards basis: LSIO naming, permissions, and runtime guidance references
 * Approval status: Community-aligned implementation; verify with LSIO maintainers for official acceptance
 */
import type { ServiceSpec, ValidationIssue, ValidationResult } from "./types.js";

export function validateLsioSpec(spec: ServiceSpec): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!/^[a-z0-9][a-z0-9._-]+$/.test(spec.imageName)) {
    issues.push({
      level: "error",
      code: "INVALID_IMAGE_NAME",
      message: "imageName should be lowercase and use only [a-z0-9._-]."
    });
  }

  if (spec.appPort !== undefined && (spec.appPort < 1 || spec.appPort > 65535)) {
    issues.push({
      level: "error",
      code: "INVALID_PORT",
      message: "appPort must be between 1 and 65535."
    });
  }

  if (!spec.maintainer) {
    issues.push({
      level: "warning",
      code: "MISSING_MAINTAINER",
      message: "maintainer is not set; defaulting to linuxserver.io in templates."
    });
  }

  if (spec.readOnlyRootFs) {
    issues.push({
      level: "warning",
      code: "READ_ONLY_NOTE",
      message: "Ensure temporary writable paths are handled when using read-only root filesystems."
    });
  }

  return {
    valid: !issues.some((item) => item.level === "error"),
    issues
  };
}
