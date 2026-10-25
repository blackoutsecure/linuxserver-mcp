/**
 * LinuxServer.io MCP Server
 * Module: Rule-based validation for LSIO-oriented service specs
 * Standards basis: LSIO naming, permissions, and runtime guidance references
 * Approval status: Community-aligned implementation; verify with LSIO maintainers for official acceptance
 */
import type {
  ServiceSpec,
  ValidationIssue,
  ValidationResult
} from './types.js';

const IMAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]+$/;
const SERVICE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]+$/;

export function validateLsioSpec(spec: ServiceSpec): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!IMAGE_NAME_PATTERN.test(spec.imageName)) {
    issues.push({
      level: 'error',
      code: 'INVALID_IMAGE_NAME',
      message: 'imageName should be lowercase and use only [a-z0-9._-].'
    });
  }

  if (spec.serviceName && !SERVICE_NAME_PATTERN.test(spec.serviceName)) {
    issues.push({
      level: 'error',
      code: 'INVALID_SERVICE_NAME',
      message: 'serviceName should be lowercase and use only [a-z0-9-].'
    });
  }

  if (!spec.serviceName) {
    issues.push({
      level: 'warning',
      code: 'MISSING_SERVICE_NAME',
      message: 'serviceName is not set; templates will fall back to imageName.'
    });
  }

  if (
    spec.appPort !== undefined &&
    (spec.appPort < 1 || spec.appPort > 65535)
  ) {
    issues.push({
      level: 'error',
      code: 'INVALID_PORT',
      message: 'appPort must be between 1 and 65535.'
    });
  }

  if (spec.appPort !== undefined && spec.appPort < 1024) {
    issues.push({
      level: 'warning',
      code: 'LOW_PORT_NOTE',
      message:
        'appPort below 1024 may require elevated container capabilities in some setups.'
    });
  }

  if (!spec.maintainer) {
    issues.push({
      level: 'warning',
      code: 'MISSING_MAINTAINER',
      message:
        'maintainer is not set; defaulting to linuxserver.io in templates.'
    });
  }

  if (spec.includeHealthcheck !== false && spec.appPort === undefined) {
    issues.push({
      level: 'warning',
      code: 'HEALTHCHECK_DEFAULT_PORT',
      message:
        'Healthcheck will default to port 8080 because appPort is not explicitly set.'
    });
  }

  if (spec.readOnlyRootFs) {
    issues.push({
      level: 'warning',
      code: 'READ_ONLY_NOTE',
      message:
        'Ensure temporary writable paths are handled when using read-only root filesystems.'
    });
  }

  return {
    valid: !issues.some((item) => item.level === 'error'),
    issues
  };
}
