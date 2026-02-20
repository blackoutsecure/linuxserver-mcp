# LinuxServer.io MCP Server

[![CI](https://github.com/blackoutmode/linuxserver-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/blackoutmode/linuxserver-mcp-server/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Server-purple)](https://modelcontextprotocol.io/)
[![Sponsor](https://img.shields.io/badge/Sponsor-Blackout%20Secure-ea4aaa)](https://github.com/sponsors/blackoutsecure)

A public MCP (Model Context Protocol) server for the LinuxServer.io community.

It helps developers and maintainers generate LinuxServer.io-style container scaffolding, validate common LSIO conventions, and reference official LSIO guidance from inside MCP-compatible AI clients.

Sponsored by Blackout Secure - https://blackoutsecure.app

> This project is community-oriented and aims to follow LinuxServer.io documentation and conventions by default.

## Why this exists

LinuxServer.io has clear conventions for container structure, permissions, and documentation. This MCP server turns those conventions into reusable tooling so you can:

- reduce repetitive setup work
- catch common spec problems early
- generate consistent starter artifacts
- reference LSIO docs quickly by topic

## Who this is for

- Community maintainers creating new LSIO-style images
- Developers adapting existing containers to LSIO patterns
- Teams building automation around Dockerfile/readme/compose scaffolding
- MCP users who want LSIO-aware assistance in their editor

## What it does

The server currently provides three MCP tools:

1. `lsio.validate_spec`
   - Validates service metadata (`imageName`, `baseImage`, `appPort`, etc.)
   - Returns structured issues (`error` and `warning`)

2. `lsio.generate_scaffold`
   - Generates LSIO-oriented scaffold output:
     - Dockerfile template text
     - README snippet
     - Docker Compose snippet
     - Required directory checklist (`/config`, `/app`, `/defaults`, `root/`)

3. `lsio.get_guidance_links`
   - Returns official LinuxServer.io links by topic
   - Topics: `all`, `base-image`, `permissions`, `read-only`, `support`, `compose`, `branding`

4. `lsio.get_best_practices`
  - Returns LinuxServer.io-aligned implementation and review checklists
  - Profiles: `all`, `docker`, `permissions`, `filesystem`, `docs`, `review`

## How it works

- Runtime: Node.js 20+
- Protocol transport: MCP stdio
- Server entrypoint: `dist/index.js`
- Architecture: small modular units for templates, validation, and scaffold orchestration

The MCP client sends tool calls, and the server responds with JSON text payloads that your assistant can use directly.

## Quick start

### Requirements

- Node.js 20+
- npm 10+

### Install and build

```bash
npm install
npm run build
```

### Run locally

```bash
npm start
```

For development:

```bash
npm run dev
```

## Configure in an MCP client

Use the built server in your MCP client config:

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

## Example usage flow

1. Call `lsio.validate_spec` with your image metadata
2. Fix any validation errors
3. Call `lsio.generate_scaffold` to create starter artifacts
4. Use `lsio.get_guidance_links` for topic-specific LSIO references while refining your image
5. Use `lsio.get_best_practices` before final review/release

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

## LSIO reference sources used by this project

- https://www.linuxserver.io/
- https://docs.linuxserver.io/
- https://docs.linuxserver.io/API/
- https://ci.linuxserver.io/
- https://linuxserver.io/discord
- https://discourse.linuxserver.io/
- https://docs.linuxserver.io/FAQ/
- https://docs.linuxserver.io/misc/non-root/
- https://docs.linuxserver.io/misc/read-only/
- https://docs.linuxserver.io/misc/support-policy/
- https://docs.linuxserver.io/general/containers-101/
- https://docs.linuxserver.io/general/container-branding/
- https://docs.linuxserver.io/general/container-customization/
- https://docs.linuxserver.io/general/container-execution/
- https://docs.linuxserver.io/general/docker-compose/
- https://docs.linuxserver.io/general/how-to-get-support/
- https://docs.linuxserver.io/general/running-our-containers/
- https://docs.linuxserver.io/general/split-dns/
- https://docs.linuxserver.io/general/swag/
- https://docs.linuxserver.io/general/understanding-puid-and-pgid/
- https://docs.linuxserver.io/general/updating-our-containers/
- https://docs.linuxserver.io/general/volumes/

## Publishing to GitHub Packages

This package is configured for GitHub Packages (`npm.pkg.github.com`).

### Manual publish

1. Ensure package scope/owner matches your GitHub org or user.
2. Authenticate with a token that has package publish permissions.
3. Build and publish:

```bash
npm run build
npm publish
```

### CI publish

Publishing workflow is available at `.github/workflows/publish-github-packages.yml` and can run on release publication.

## Contributing

Contributions are welcome for:

- additional LSIO validation rules
- richer scaffolding templates
- more MCP tools for repo scaffolding and docs generation
- improved ecosystem examples for MCP clients

Please keep changes aligned with LinuxServer.io conventions and official docs.

## LSIO Alignment and Approval Note

This project follows LinuxServer.io conventions as a community implementation and reference tool.

- It is not an official LinuxServer.io release unless explicitly approved by LSIO maintainers.
- When adding new modules, use a standard file header that includes:
  - project/module purpose
  - standards basis (which LSIO docs area it aligns to)
  - current approval status (community-aligned vs. officially approved)
- If you plan to submit tooling/output for official LSIO adoption, confirm acceptance criteria with LSIO maintainers before release.

## Workspace Best-Practice Review

Before merging changes, review:

- base image and service assumptions against LSIO docs
- `PUID`/`PGID` and non-root guidance in generated examples
- required directories and persistent-volume expectations
- read-only and volume notes when filesystem behavior is changed
- support language and links (FAQ, support policy, Discord/forums)
- comment/header standard in source and workflow files where comments are supported

## Support & Sponsorship

If this project helps your team, you can support ongoing maintenance and new feature work:

- GitHub Sponsors: https://github.com/sponsors/blackoutsecure
- Sponsor organization: https://github.com/blackoutsecure
- Sponsored by Blackout Secure: https://blackoutsecure.app

## License

GPL-3.0
