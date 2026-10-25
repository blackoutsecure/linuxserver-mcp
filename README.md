# LinuxServer MCP

[![Made by BlackoutSecure](https://img.shields.io/badge/Made%20by-BlackoutSecure-blue)](https://github.com/blackoutsecure)
[![CI](https://github.com/blackoutsecure/linuxserver-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/blackoutsecure/linuxserver-mcp/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

Community MCP server and registry UI for LinuxServer.io image discovery, container audits, image request research, scaffolding, validation, and development guidance.

Provided by Blackout Secure and sponsored by Blackout Secure for the LinuxServer.io community.

> Audit results are derived from public LinuxServer.io documentation and are intended as community guidance. They are not an official LinuxServer.io certification, support decision, or approval decision.

## Canonical repository and migration

[blackoutsecure/linuxserver-mcp](https://github.com/blackoutsecure/linuxserver-mcp) is the canonical Blackout Secure repository for this project, not an official LinuxServer.io release.

This repository consolidates:

- [linuxserver-mcp-registry](https://github.com/blackoutsecure/linuxserver-mcp-registry) at `7ad877a`: image discovery, usage audits, request research, the registry UI, and the Cloudflare Worker.
- [blackoutsecure/linuxserver-mcp-server](https://github.com/blackoutsecure/linuxserver-mcp-server) at `eaa5b0c`: container authoring tools.
- [blackoutmode/linuxserver-mcp-server](https://github.com/blackoutmode/linuxserver-mcp-server) at `6eb7188`, including its local checkout: the same authoring implementation, its fuller usage documentation, and the dev container.

The source histories are retained. The original repositories and local checkouts are not deleted or archived. Duplicate authoring code is imported once under `packages/mcp-server/src/authoring/`; there is one MCP server implementation and one npm lockfile.

For existing clients, switch the package name to `@blackoutsecure/linuxserver-mcp`. The installed command aliases `linuxserver-mcp-registry` and `linuxserver-mcp-server` remain available alongside `linuxserver-mcp`. For local Node clients, use `packages/mcp-server/dist/cli.js`, not the library entry point `dist/index.js`. All 22 original tool names are retained.

## What this project does

This project helps users and AI assistants:

- Search LinuxServer.io images and inspect normalized metadata.
- Audit Docker Compose and `docker run` text against documented LinuxServer.io-style conventions.
- Search open and closed LinuxServer.io Image Requests before creating duplicates.
- Prepare image request drafts without submitting them.
- Surface known issues, status, support, documentation, and donation links.
- Validate LSIO-style service metadata and generate Dockerfile, Compose, and README scaffolds.
- Audit candidate image artifacts and return remediation snippets.
- Provide documentation links, best-practice checklists, skillsets, and optimization ideas.
- Publish an MCP server through the GitHub MCP Registry ecosystem.

## Features

The monorepo contains a TypeScript MCP stdio package, a Hono Cloudflare Worker with Streamable HTTP and REST routes, and a React Cloudflare Pages registry UI. The stdio and HTTP transports expose the same 22 MCP tools. The web UI retains the image discovery, usage audit, and request research workflows. All external lookups are best effort and retain source links. GitHub access is read-only.

## MCP tools

| Tool                          | Purpose                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `lsio.search_images`          | Search current image metadata.                                     |
| `lsio.get_image`              | Fetch one normalized image record.                                 |
| `lsio.audit_image`            | Audit an image and optional Compose or run text.                   |
| `lsio.audit_compose`          | Parse Compose YAML and audit LinuxServer.io services.              |
| `lsio.list_categories`        | List categories, counts, and examples.                             |
| `lsio.get_known_issues`       | Return known-issue and service-status context.                     |
| `lsio.search_image_requests`  | Search open, closed, or all Image Requests.                        |
| `lsio.pending_image_requests` | Search open Image Requests.                                        |
| `lsio.closed_image_requests`  | Search closed Image Requests.                                      |
| `lsio.recommended_new_images` | Compare inventory and request history for possible gaps.           |
| `lsio.prepare_image_request`  | Prepare a Markdown draft without posting it.                       |
| `lsio.image_pipeline`         | Run the complete inventory/request/issue decision workflow.        |
| `lsio.get_support_links`      | Return useful LinuxServer.io community links.                      |
| `lsio.validate_spec`          | Validate LSIO-style service metadata.                              |
| `lsio.generate_scaffold`      | Generate Dockerfile, Compose, and README snippets.                 |
| `lsio.get_guidance_links`     | Return official LSIO documentation by topic.                       |
| `lsio.get_best_practices`     | Return implementation and review checklists.                       |
| `lsio.get_skillsets`          | Return discovery, maintenance, review, release, and docs profiles. |
| `lsio.lookup_official_image`  | Check official image listing and documentation signals.            |
| `lsio.audit_image_compliance` | Audit candidate artifacts and return remediation scaffolds.        |
| `lsio.generate_dockerfile`    | Generate a Dockerfile with validation findings.                    |
| `lsio.get_optimization_ideas` | Return scoped improvement ideas.                                   |

The two audit families remain distinct: `audit_image` and `audit_compose` inspect deployed usage, while `audit_image_compliance` inspects candidate Dockerfile, Compose, and README artifacts. Guidance is not certification.

## Container authoring workflow

1. Call `lsio.validate_spec` with a service specification.
2. Resolve validation errors, then call `lsio.generate_scaffold` or `lsio.generate_dockerfile`.
3. Use `lsio.lookup_official_image` to check whether an official image already exists.
4. Call `lsio.audit_image_compliance` with candidate artifacts and apply its recommendations.
5. Review the relevant guidance, best practices, and skillsets before publishing.

Example service specification:

```json
{
  "imageName": "sampleapp",
  "baseImage": "alpine",
  "appPort": 8080,
  "serviceName": "sampleapp",
  "readOnlyRootFs": false,
  "includeHealthcheck": true
}
```

Scaffolds are returned as text, never written to disk or executed. They include the `/config`, `/app`, `/defaults`, and `root/` directory checklist. Set `checkOfficialImage: false` for an offline candidate-artifact audit.

## How image request search works

The server searches GitHub's public Image Requests category. When `GITHUB_TOKEN` is available it uses the backing repository's read-only GraphQL discussion connection for richer metadata. Without a token it parses the public open and closed category pages and returns a clear best-effort notice. A token is never required for basic image, request-search, or audit functionality.

Search is read-only. The project never comments, reacts, submits, or plus-ones a discussion.

## Why closed requests are searched

Closed discussions can document a duplicate, rejection, accepted request, superseded proposal, or an image that was added later. The pipeline checks both open and closed requests before describing a new request as potentially reasonable.

## How audits work

Compose YAML is parsed with a safe YAML parser and `docker run` commands are inspected as plain text. Neither is executed. Results describe whether input passes this project's checks; they never claim a container is secure or officially approved.

## Audit rubric

Checks cover image existence, `/config` persistence, host-to-container volume direction, PUID/PGID, TZ, Compose restart policy, port exposure, privileged mode, Docker socket and broad host mounts, host networking, possible inline secrets, ambiguous tags, Docker Mods, custom init/services, branding review, update guidance, and support readiness.

## Data sources

- [LinuxServer.io](https://www.linuxserver.io/)
- [API documentation](https://docs.linuxserver.io/API/)
- [Image catalog](https://www.linuxserver.io/our-images)
- [Images by category](https://docs.linuxserver.io/images-by-category/)
- [Image Requests](https://github.com/orgs/linuxserver/discussions/categories/image-requests)
- [Known issues](https://info.linuxserver.io/)
- [Status dashboard](https://status.linuxserver.io/)
- [Support](https://www.linuxserver.io/support)
- [Donate](https://www.linuxserver.io/donate)

## Local development

Requirements: Node.js 22 or later and npm.

```bash
npm ci
npm run build
npm test
npm run lint
npm run typecheck
```

Start the stdio server:

```bash
npm start
```

Start the registry UI:

```bash
npm run dev
```

Run the Worker separately with `npm run dev --workspace=@blackoutsecure/linuxserver-mcp-worker`. The web dev server proxies `/api` to Worker port `8787`. VS Code can launch the stdio MCP package using [.vscode/mcp.json](.vscode/mcp.json).

The dev container uses Node.js 22 and installs/builds the MCP package on creation. `npm run release:check` runs the complete local validation gate; `npm run release:pack` checks the npm package contents without publishing.

## Cloudflare deployment

Run Wrangler commands from the repository root; no global install is required.

1. Create cache namespaces with `npx wrangler kv namespace create CACHE` and `npx wrangler kv namespace create CACHE --preview`.
2. Replace all placeholder KV IDs in [wrangler.toml](wrangler.toml), including any production environment overrides you intend to use.
3. Store an optional read-only `GITHUB_TOKEN` with `npx wrangler secret put GITHUB_TOKEN`.
4. Deploy the Worker with `npx wrangler deploy` and verify its `/health` and `/mcp` endpoints.
5. Set `VITE_API_BASE_URL` to the actual Worker origin, build the web workspace, then deploy `apps/web/dist` with `npx wrangler pages deploy apps/web/dist --project-name=linuxserver-mcp`. Create the Pages project in your account first if needed.
6. After verification, update `websiteUrl` and add the deployed Streamable HTTP `/mcp` URL under `remotes` in both copies of `server.json`.

This import does not publish npm packages, deploy Cloudflare resources, or claim that a new public endpoint is live. Old deployment URLs are deliberately not advertised by the canonical manifests.

## MCP Registry publishing

[server.json](server.json) and its package copy declare `io.github.blackoutsecure/linuxserver-mcp` and `@blackoutsecure/linuxserver-mcp`. Keep both manifests and the package version aligned. The package includes the required `mcpName`, license, and attribution notice.

Publishing is manual through the **Publish** workflow on `main`, never triggered by an import or ordinary push. Select npm or GitHub Packages:

- npm requires the canonical repository's `NPM_TOKEN` publishing secret.
- GitHub Packages uses that repository's `GITHUB_TOKEN` with package-write permission.
- Optional Cloudflare deployment additionally requires `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, configured KV IDs, and the `VITE_API_BASE_URL` repository variable.

After publication, clients can use `npx @blackoutsecure/linuxserver-mcp`. Validate the installed package and any advertised remote transport before submitting metadata to the official [MCP Registry](https://registry.modelcontextprotocol.io/). GitHub repository migration alone does not publish or transfer an npm package, MCP Registry listing, deployment, or secret.

## GitHub Copilot organization registry support

The Worker implements:

- `GET /v0.1/servers`
- `GET /v0.1/servers/{serverName}/versions/latest`
- `GET /v0.1/servers/{serverName}/versions/{version}`

These endpoints allow `GET` and `OPTIONS` cross-origin requests with `Authorization` and `Content-Type` headers.

## Environment variables

| Variable            | Default                      | Use                                          |
| ------------------- | ---------------------------- | -------------------------------------------- |
| `LSIO_API_BASE_URL` | `https://api.linuxserver.io` | Image metadata API origin.                   |
| `GITHUB_TOKEN`      | unset                        | Optional richer read-only discussion search. |
| `CACHE_TTL_SECONDS` | `3600`                       | External lookup cache lifetime.              |
| `LOG_LEVEL`         | `info`                       | Runtime logging threshold.                   |

Tokens are never stored or printed and are not used for discussion mutations.

## Security model

All tool inputs are validated with Zod. User-provided Compose, Docker, and shell-like text is never executed. Public write-like endpoints are rate limited. Secrets are neither persisted nor logged. Drafts are shown to the caller only and are never submitted automatically. See [SECURITY.md](SECURITY.md).

## Rate limiting and caching

Audit, pipeline, draft, and MCP POST routes use per-client in-memory rate limiting. External image, request, issue, and status responses are cached in-process and in the configured Cloudflare KV namespace. Multi-isolate production deployments should move rate-limit counters to a durable Cloudflare service.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and include focused tests for behavior changes.

## Support boundaries

Use this repository's issue tracker for project bugs. Use LinuxServer.io's own documentation and support channels for container support. Blackout Secure does not speak for LinuxServer.io, and this project cannot approve or reject image requests.

## License

GPL-3.0 for the combined project. The original MIT registry attribution and permission notice are preserved in [NOTICE](NOTICE), including in the npm package. See [LICENSE](LICENSE).
