# LinuxServer.io MCP Server

[![CI](https://github.com/blackoutmode/linuxserver-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/blackoutmode/linuxserver-mcp-server/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Server-purple)](https://modelcontextprotocol.io/)

Community-first MCP (Model Context Protocol) server for LinuxServer.io-style container scaffolding and validation.

This project is community-maintained and follows LinuxServer.io standards and official docs by default. It is not an official LinuxServer.io release unless explicitly approved by LSIO maintainers.

> Documentation policy for this repository: this README is the single maintained public documentation source.

## Why use this

- Gives contributors a practical starting point for LSIO-style images.
- Validates common convention issues early (naming, ports, metadata).
- Generates scaffold content consistently (Dockerfile, Compose, README snippets).
- Keeps guidance anchored to LSIO docs and support references.

## Core capabilities

1. `lsio.validate_spec`
   - Validates service metadata (`imageName`, `baseImage`, `appPort`, etc.).
   - Returns structured validation output (`error`/`warning`).

2. `lsio.generate_scaffold`
   - Generates Dockerfile, README snippet, and Compose snippet.
   - Includes required LSIO directory checklist: `/config`, `/app`, `/defaults`, `root/`.

3. `lsio.get_guidance_links`
   - Returns official LSIO references by topic (`all`, `base-image`, `permissions`, `read-only`, `support`, `compose`, `branding`).

4. `lsio.get_best_practices`
   - Returns implementation/review checklists aligned with LSIO community standards.

## Quick start

### Requirements

- Node.js 20+
- npm 10+

### Install, build, test

```bash
npm ci
npm run build
npm test
```

### Run server

```bash
npm start
```

Development mode:

```bash
npm run dev
```

## MCP client configuration

```json
{
  "mcpServers": {
    "linuxserver": {
      "command": "node",
      "args": ["/absolute/path/to/linuxserver-mcp-server/dist/index.js"]
    }
  }
}
```

## Typical usage flow

1. Run `lsio.validate_spec` for your image metadata.
2. Resolve validation errors/warnings.
3. Run `lsio.generate_scaffold` for starter artifacts.
4. Use `lsio.get_guidance_links` and `lsio.get_best_practices` before final review.

## Example spec

```json
{
  "imageName": "myapp",
  "baseImage": "alpine",
  "maintainer": "you@example.com",
  "appPort": 8080,
  "serviceName": "myapp",
  "readOnlyRootFs": false,
  "includeHealthcheck": true
}
```

## Community standards and references

Primary standards source:

- https://www.linuxserver.io/
- https://docs.linuxserver.io/
- https://docs.linuxserver.io/general/docker-compose/
- https://docs.linuxserver.io/general/understanding-puid-and-pgid/
- https://docs.linuxserver.io/misc/non-root/
- https://docs.linuxserver.io/misc/read-only/
- https://docs.linuxserver.io/misc/support-policy/

MCP ecosystem source for additional tool integrations:

- https://github.com/mcp

## Development and release

Build/test gate:

```bash
npm run release:check
```

Package dry-run:

```bash
npm run release:pack
```

Publish workflow:

- `.github/workflows/publish-github-packages.yml`

## Contributing

Priorities for contributions:

- Improve reusable validation and scaffold logic.
- Remove redundant code and prefer shared functions/utilities.
- Keep implementation small, predictable, and testable.
- Follow LSIO community guidance first when design choices conflict.

## Support

- GitHub Sponsors: https://github.com/sponsors/blackoutsecure
- Sponsor org: https://github.com/blackoutsecure
- Sponsored by Blackout Secure: https://blackoutsecure.app

## License

GPL-3.0
