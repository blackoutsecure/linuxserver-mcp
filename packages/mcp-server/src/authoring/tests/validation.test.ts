/**
 * LinuxServer.io MCP Server
 * Module: Validation unit tests
 * Standards basis: LSIO naming, permissions, and metadata guidance
 * Approval status: Community-aligned implementation; verify with LSIO maintainers for official acceptance
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { validateLsioSpec } from '../validation.js';

test('validateLsioSpec accepts a valid baseline spec', () => {
  const result = validateLsioSpec({
    imageName: 'sampleapp',
    baseImage: 'alpine',
    appPort: 8080,
    serviceName: 'sampleapp'
  });

  assert.equal(result.valid, true);
  assert.ok(result.issues.some((issue) => issue.code === 'MISSING_MAINTAINER'));
});

test('validateLsioSpec rejects invalid image names', () => {
  const result = validateLsioSpec({
    imageName: 'Bad Name',
    baseImage: 'ubuntu'
  });

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_IMAGE_NAME'));
});

test('validateLsioSpec rejects invalid port ranges', () => {
  const result = validateLsioSpec({
    imageName: 'sampleapp',
    baseImage: 'alpine',
    appPort: 70000
  });

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_PORT'));
});

test('validateLsioSpec rejects invalid service names', () => {
  const result = validateLsioSpec({
    imageName: 'sampleapp',
    baseImage: 'alpine',
    serviceName: 'Bad Name'
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'INVALID_SERVICE_NAME')
  );
});

test('validateLsioSpec warns when healthcheck defaults to 8080', () => {
  const result = validateLsioSpec({
    imageName: 'sampleapp',
    baseImage: 'alpine',
    includeHealthcheck: true
  });

  assert.equal(result.valid, true);
  assert.ok(
    result.issues.some((issue) => issue.code === 'HEALTHCHECK_DEFAULT_PORT')
  );
});
