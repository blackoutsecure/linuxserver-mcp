/**
 * LinuxServer.io MCP Server
 * Module: Official image lookup and compliance audit unit tests
 * Standards basis: LSIO image discovery and policy-aligned remediation behavior
 * Approval status: Community-aligned implementation; verify with LSIO maintainers for official acceptance
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  auditImageCompliance,
  detectImageInCatalogHtml,
  getOfficialDocsUrl
} from '../image-audit.js';

test('authoring lookups share catalog normalization for registry and digest references', () => {
  assert.equal(
    getOfficialDocsUrl('ghcr.io/linuxserver/Sonarr@sha256:abcdef'),
    'https://docs.linuxserver.io/images/docker-sonarr/'
  );
});

test('detectImageInCatalogHtml detects official image links', () => {
  const html = `
    <a href="/images/docker-sonarr/">Sonarr</a>
    <a href="/images/docker-radarr/">Radarr</a>
  `;

  assert.equal(detectImageInCatalogHtml(html, 'sonarr'), true);
  assert.equal(detectImageInCatalogHtml(html, 'prowlarr'), false);
});

test('auditImageCompliance reports strong alignment for scaffold-like artifacts', () => {
  const result = auditImageCompliance({
    imageName: 'sampleapp',
    baseImage: 'alpine',
    appPort: 8080,
    serviceName: 'sampleapp',
    includeHealthcheck: true,
    candidateDockerfile: `
      FROM lscr.io/linuxserver/baseimage-alpine:3.22
      ENV PUID=1000 PGID=1000
      RUN mkdir -p /config /app /defaults /etc/s6-overlay/s6-rc.d/sampleapp
      VOLUME /config
      HEALTHCHECK CMD curl -f http://localhost:8080/ || exit 1
    `,
    candidateCompose: `
      services:
        sampleapp:
          environment:
            PUID: 1000
            PGID: 1000
          volumes:
            - ./config:/config
    `,
    candidateReadme: 'Supports PUID and PGID with /config mapping.'
  });

  assert.ok(result.score >= 85);
  assert.equal(
    result.checks.some((check) => check.status === 'fail'),
    false
  );
  assert.ok(
    result.remediation?.dockerfile.includes(
      'FROM lscr.io/linuxserver/baseimage-alpine'
    )
  );
});

test('auditImageCompliance recommends fixes for missing LSIO signals', () => {
  const result = auditImageCompliance({
    imageName: 'sampleapp',
    baseImage: 'ubuntu',
    serviceName: 'sampleapp',
    includeHealthcheck: true,
    candidateDockerfile: 'FROM ubuntu:24.04\nRUN mkdir -p /srv',
    candidateCompose: 'services:\n  sampleapp:\n    image: ubuntu',
    candidateReadme: 'No LSIO specifics.'
  });

  assert.ok(
    result.checks.some(
      (check) => check.id === 'lsio-base-image' && check.status === 'fail'
    )
  );
  assert.ok(
    result.recommendations.some((item) => item.includes('LSIO base image'))
  );
});
