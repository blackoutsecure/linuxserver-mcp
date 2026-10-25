/**
 * LinuxServer.io MCP Server
 * Module: Template rendering for Dockerfile, README snippets, and Compose snippets
 * Standards basis: LSIO base-image, PUID/PGID, /config and service-structure conventions
 * Approval status: Community-aligned implementation; verify with LSIO maintainers for official acceptance
 */
import type { ServiceSpec } from './types.js';

const LSIO_BASE_IMAGES: Record<ServiceSpec['baseImage'], string> = {
  alpine: 'lscr.io/linuxserver/baseimage-alpine:3.22',
  ubuntu: 'lscr.io/linuxserver/baseimage-ubuntu:noble'
};

export function renderDockerfile(spec: ServiceSpec): string {
  const baseImage = LSIO_BASE_IMAGES[spec.baseImage];
  const serviceName = spec.serviceName ?? spec.imageName;
  const maintainer = spec.maintainer ?? 'linuxserver.io';
  const appPort = spec.appPort ?? 8080;
  const healthcheck =
    spec.includeHealthcheck === false
      ? ''
      : `\nHEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \\\n  CMD curl -fsS http://localhost:${appPort}/ || exit 1`;
  const readOnlyNote = spec.readOnlyRootFs
    ? '\n# Note: read-only root filesystem mode requires writable exceptions (for example /tmp, /run).'
    : '';

  return `FROM ${baseImage}

LABEL maintainer="${maintainer}"

ENV PUID=1000 \\
    PGID=1000 \\
    TZ=Etc/UTC

RUN mkdir -p /config /app /defaults /etc/s6-overlay/s6-rc.d/${serviceName} /etc/s6-overlay/s6-rc.d/user/contents.d

COPY root/ /

EXPOSE ${appPort}
VOLUME /config
${readOnlyNote}${healthcheck}
`;
}

export function renderReadmeSnippet(spec: ServiceSpec): string {
  const appPort = spec.appPort ?? 8080;
  const readOnlyComposeHint = spec.readOnlyRootFs
    ? '    read_only: true\n    tmpfs:\n      - /tmp\n      - /run\n'
    : '';

  return `## Application Setup

This container follows LinuxServer.io conventions:
- Uses LSIO base image with s6-overlay
- Supports \`PUID\` and \`PGID\`
- Uses persistent \`/config\` volume

### Example docker-compose

\`\`\`yaml
services:
  ${spec.imageName}:
    image: ghcr.io/yourorg/${spec.imageName}:latest
    container_name: ${spec.imageName}
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Etc/UTC
    volumes:
      - ./config:/config
    ports:
      - "${appPort}:${appPort}"
${readOnlyComposeHint}    restart: unless-stopped
\`\`\`
`;
}

export function renderComposeSnippet(spec: ServiceSpec): string {
  const appPort = spec.appPort ?? 8080;
  const readOnlyBlock = spec.readOnlyRootFs
    ? '\n    read_only: true\n    tmpfs:\n      - /tmp\n      - /run'
    : '';

  return `services:
  ${spec.imageName}:
    image: ghcr.io/yourorg/${spec.imageName}:latest
    environment:
      PUID: 1000
      PGID: 1000
      TZ: Etc/UTC
    volumes:
      - ./config:/config
    ports:
      - "${appPort}:${appPort}"
${readOnlyBlock}
    restart: unless-stopped`;
}
