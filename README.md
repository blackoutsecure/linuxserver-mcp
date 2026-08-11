# LinuxServer.io MCP Registry

Community MCP server and registry UI for LinuxServer.io image discovery, documentation-derived container audits, open and closed image request search, and image request preparation.

Provided by Blackout Secure and sponsored by Blackout Secure for the LinuxServer.io community.

> Audit results are derived from public LinuxServer.io documentation and are intended as community guidance. They are not an official LinuxServer.io certification, support decision, or approval decision.

## What this project does

This project helps users and AI assistants:

- Search LinuxServer.io images and inspect normalized metadata.
- Audit Docker Compose and `docker run` text against documented LinuxServer.io-style conventions.
- Search open and closed LinuxServer.io Image Requests before creating duplicates.
- Prepare image request drafts without submitting them.
- Surface known issues, status, support, documentation, and donation links.
- Publish an MCP server through the GitHub MCP Registry ecosystem.

## Features

The monorepo contains a TypeScript MCP stdio package, a Hono Cloudflare Worker with Streamable HTTP and REST routes, and a React Cloudflare Pages registry UI. All external lookups are best effort and retain source links. GitHub access is read-only.

## MCP tools

| Tool                          | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `lsio.search_images`          | Search current image metadata.                              |
| `lsio.get_image`              | Fetch one normalized image record.                          |
| `lsio.audit_image`            | Audit an image and optional Compose or run text.            |
| `lsio.audit_compose`          | Parse Compose YAML and audit LinuxServer.io services.       |
| `lsio.list_categories`        | List categories, counts, and examples.                      |
| `lsio.get_known_issues`       | Return known-issue and service-status context.              |
| `lsio.search_image_requests`  | Search open, closed, or all Image Requests.                 |
| `lsio.pending_image_requests` | Search open Image Requests.                                 |
| `lsio.closed_image_requests`  | Search closed Image Requests.                               |
| `lsio.recommended_new_images` | Compare inventory and request history for possible gaps.    |
| `lsio.prepare_image_request`  | Prepare a Markdown draft without posting it.                |
| `lsio.image_pipeline`         | Run the complete inventory/request/issue decision workflow. |
| `lsio.get_support_links`      | Return useful LinuxServer.io community links.               |

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
npm run dev
```

Run the Worker separately with `npm run dev --workspace=@blackoutsecure/linuxserver-mcp-worker`. The web dev server proxies `/api` to Worker port `8787`. VS Code can launch the stdio MCP package using [.vscode/mcp.json](.vscode/mcp.json).

## Cloudflare deployment

1. Replace the placeholder KV IDs in [wrangler.toml](wrangler.toml).
2. Store any optional `GITHUB_TOKEN` with `wrangler secret put GITHUB_TOKEN`.
3. Deploy the Worker with `npx wrangler deploy`.
4. Build `apps/web` and deploy `apps/web/dist` to Cloudflare Pages with `VITE_API_BASE_URL` set to the Worker origin.

## MCP Registry publishing

[server.json](server.json) contains the MCP namespace, npm package, repository, and remote transport metadata. Validate the npm package and remote endpoint before enabling the publish workflow placeholder.

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

MIT. See [LICENSE](LICENSE).
