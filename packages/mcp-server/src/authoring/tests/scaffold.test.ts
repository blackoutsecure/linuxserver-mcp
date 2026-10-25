/**
 * LinuxServer.io MCP Server
 * Module: Scaffold generation unit tests
 * Standards basis: LSIO base-image, directory layout, and PUID/PGID conventions
 * Approval status: Community-aligned implementation; verify with LSIO maintainers for official acceptance
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { scaffoldLsioService } from '../scaffold.js';

test('scaffoldLsioService returns required sections and directories', () => {
  const scaffold = scaffoldLsioService({
    imageName: 'myapp',
    baseImage: 'alpine',
    appPort: 8080,
    includeHealthcheck: true
  });

  assert.ok(scaffold.dockerfile.includes('PUID=1000'));
  assert.ok(scaffold.dockerfile.includes('PGID=1000'));
  assert.ok(scaffold.dockerfile.includes('VOLUME /config'));
  assert.ok(scaffold.dockerfile.includes('HEALTHCHECK'));
  assert.ok(
    scaffold.dockerfile.includes('\n  CMD curl -fsS http://localhost:8080/')
  );
  assert.equal(scaffold.dockerfile.includes('\n+'), false);
  assert.deepEqual(scaffold.directories, [
    '/config',
    '/app',
    '/defaults',
    'root/'
  ]);
});

test('scaffoldLsioService omits healthcheck when disabled', () => {
  const scaffold = scaffoldLsioService({
    imageName: 'myapp',
    baseImage: 'ubuntu',
    appPort: 8080,
    includeHealthcheck: false
  });

  assert.equal(scaffold.dockerfile.includes('HEALTHCHECK'), false);
});

test('scaffoldLsioService includes read-only hints when enabled', () => {
  const scaffold = scaffoldLsioService({
    imageName: 'myapp',
    baseImage: 'alpine',
    appPort: 8080,
    readOnlyRootFs: true
  });

  assert.ok(scaffold.composeSnippet.includes('read_only: true'));
  assert.ok(scaffold.composeSnippet.includes('tmpfs'));
  assert.ok(scaffold.dockerfile.includes('read-only root filesystem mode'));
});

test('scaffoldLsioService throws on invalid specs', () => {
  assert.throws(
    () =>
      scaffoldLsioService({
        imageName: 'Bad Name',
        baseImage: 'alpine'
      }),
    /Invalid spec:/
  );
});
