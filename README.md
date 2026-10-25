# LinuxServer MCP

[![Made by BlackoutSecure](https://img.shields.io/badge/Made%20by-BlackoutSecure-blue)](https://github.com/blackoutsecure)
[![CI](https://github.com/blackoutsecure/linuxserver-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/blackoutsecure/linuxserver-mcp/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

Bridge LinuxServer.io knowledge into MCP and GitHub. Audit accurately. Review intelligently. Automate responsibly.

Community MCP server and GitHub review tooling for LinuxServer.io: image discovery, evidence-backed repository audits, request research, container authoring, and deterministic PR review.

> [!IMPORTANT]
> **Community Project**
>
> `linuxserver-mcp` is an independent community project and is not affiliated with, endorsed by, sponsored by, or maintained by LinuxServer.io.

Maintained by Blackout Secure for the community. Findings are not official LinuxServer policy, certification, support decisions, or request approvals.

## Product and implementation status

The shared policy/audit engine is the core product. MCP and GitHub are first-class interfaces; neither MCP nor AI is required to audit a repository.

| Component                                                                                   | Current status                                                                                                        |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Policy/audit core                                                                           | Versioned policy v1, 12 sourced rules, normalized evidence, configuration, suppressions, and diff-aware relevance.    |
| CLI                                                                                         | Local audit/review with text, JSON, GitHub annotations, and SARIF. No LLM or network required.                        |
| MCP server                                                                                  | 25 tools over stdio and stateless Streamable HTTP `/mcp`; 22 legacy names retained.                                   |
| GitHub Action                                                                               | Bundled Node.js Action; read-only PR-file lookup, deterministic review, workflow annotations, JSON and SARIF reports. |
| Registry UI/Worker                                                                          | Image discovery, usage audits, and request research. Local runtime supported; deployment is optional.                 |
| GitHub App/custom Check Runs                                                                | Planned beta work, not implemented or deployed. Action annotations currently use the workflow's own check.            |
| Prepared fixes, approved writes, fork/PR automation                                         | Planned, not exposed. No tool applies changes or posts to GitHub.                                                     |
| Full SBOM/attestation inspection, semantic duplicates, upstream application release history | Future extensions, not implied by the current checks.                                                                 |

## Architecture

```text
                         +-- MCP stdio / HTTP
                         |
Portable policy core ----+-- Local CLI
                         |
                         +-- GitHub Action / deterministic PR review
                         |
                         +-- text / JSON / annotations / SARIF
```

- `packages/mcp-server/src/core/`: schemas, inspection, policy v1, findings, suppression, and report formats.
- `apps/cli/`: bounded local filesystem adapter and CLI.
- `apps/github-action/`: bounded GitHub reads and Action adapter; no Action-specific policies.
- `packages/mcp-server/src/mcp/`: MCP interface; `services/`: data adapters and legacy usage checks.
- `worker/` and `apps/web/`: Cloudflare HTTP and registry UI.

One publishable package and the established npm lockfile are retained. Empty packages, a second package manager, App scaffolds, and write endpoints are deliberately not introduced. See [ADR 0001](docs/adr/0001-shared-engine-and-safe-interfaces.md) and [contributor instructions](.github/copilot-instructions.md).

## Local development

Requirements: Node.js 22 or later and npm.

```bash
npm ci
npm run build
npm test
npm run lint
npm run typecheck
```

`npm start` launches stdio MCP. `npm run dev` starts the UI; run the Worker separately with `npm run dev --workspace=@blackoutsecure/linuxserver-mcp-worker`. The UI proxies `/api` to Worker port 8787.

The dev container installs dependencies and builds the MCP package. [VS Code configuration](.vscode/mcp.json) launches the legacy-compatible stdio entry point.

## CLI

After building, from the repository root:

```bash
npm run audit -- . --format text
node packages/mcp-server/dist/command.js audit . --format json
node packages/mcp-server/dist/command.js audit . --format github
node packages/mcp-server/dist/command.js audit . --format sarif --output linuxserver-mcp.sarif
```

After publication, the equivalent installed command is `linuxserver-mcp audit .`, or `npx @blackoutsecure/linuxserver-mcp audit .`.

For a diff-aware local review, create a JSON array of changed relative paths, then:

```bash
linuxserver-mcp review . --changed-files changed-paths.json --format text
```

Commands never execute or modify repository files. `--output` creates a new report and refuses to overwrite an existing file. Formats are projections of the same findings. Paths in local reports are relative to the analyzed directory.

Exit codes: **0** analysis completed without crossing the configured threshold, **1** threshold reached, **2** invalid input or runtime/upstream error. A `not_applicable` report explicitly means no supported container sources were found, not a successful container certification.

`--fail-on error|warning|info|none` overrides the repository failure threshold. Warning/info thresholds include higher severities; `none` is an explicit opt-out, never the default. No arguments, or `stdio`, still starts MCP for existing clients.

## Repository policy configuration

Copy [the example](examples/linuxserver-mcp.yml) to `.github/linuxserver-mcp.yml`. The version is required and unknown keys fail validation.

```yaml
version: 1
policy:
  profile: recommended
review:
  changed_files_only: true
severity:
  fail_on: [error]
agent:
  enabled: false
  suggestions: false
  automatic_writes: false
```

Profiles: `recommended` includes all implemented rules; `linuxserver` excludes general security/supply-chain advisories; `security` selects those advisories only. Checks can be disabled individually. Disabled/non-relevant rules are listed in reports.

Suppressions use a stable rule ID, exact relative evidence paths, and a non-empty reason. Suppressed findings remain visible, including SARIF suppressions. Invalid-source rules cannot be suppressed. `automatic_writes: true` and `review_comments: true` are rejected; agent settings do not activate an unimplemented agent.

## Policy v1

The catalogue checks:

- Explicit generated-file markers against README/build source changes.
- Safe README, Jenkins, and Compose metadata parsing.
- Literal final-stage Dockerfile ports versus README ports.
- Recognized architecture-specific Dockerfiles versus explicit architecture metadata.
- Literal CI test ports versus README ports.
- Compose usage contradicting explicitly unsupported read-only/non-root metadata.
- Explicit s6-rc type definitions and missing longrun scripts in complete snapshots.
- Custom downstream image branding without the documented setting.
- Literal world-writable permissions and remote-script-to-shell pipelines as **general security advice/heuristics**, not LinuxServer policy.

See [rule IDs, sources, applicability, and limitations](docs/policies/v1.md). Every finding carries policy version, severity, confidence, classification, evidence, source links, and manual remediation. Cross-file findings retain both sides.

Missing metadata stays unknown. There are no universal PUID/PGID, `/config`, healthcheck, read-only, or non-root requirements in this repository policy engine. Legacy scaffold/usage tools retain their explicitly opinionated project checklists; those are not official requirements.

## GitHub Action and PR review

The root [action.yml](action.yml) runs a committed standalone bundle. Consumers do not install dependencies or execute files from the reviewed repository.

After the canonical repository is published and a reviewed version exists:

```yaml
name: LinuxServer Review
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
permissions:
  contents: read
  pull-requests: read
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false
      - uses: blackoutsecure/linuxserver-mcp@v1 # After release; pin a reviewed full SHA in production.
        id: review
        with:
          mode: review
          policy: recommended
          annotate: true
          fail-on: error
```

No `checks: write`, comment, contents-write, or App permissions are needed for workflow annotations. A separate optional Code Scanning upload needs `security-events: write` and the repository's normal fork/Code Scanning permissions. SARIF generation itself requires neither GitHub nor upload permission.

Inputs include `path`, `mode: audit|review`, optional policy/threshold overrides, `annotate`, optional read-only `token`, and optional `changed-files` JSON. Review without an explicit path list reads PR files through the fixed GitHub API, checks head/base revisions before and after pagination, and fails if stale or incomplete. Renames include both paths. Subdirectory annotations remain workspace-relative.

Outputs: `sarif-file`, `findings`, `failed`. SARIF and JSON are written under `RUNNER_TEMP`; summaries respect repository configuration. Findings never produce PR comments, commits, fixes, or custom Check Runs. `pull_request_target` and mutation modes are rejected.

Use the normal event-revision checkout before review. The Action audits the
local snapshot you provide; GitHub revision reads validate the changed-file
context, not the identity of arbitrary local edits. Require maintainer review
for policy-configuration changes, including suppressions and disabled rules.

## MCP tools

All tools are read-only or deterministic drafts. See [per-tool inputs, outputs, auth, sources, failures, and examples](docs/tools.md).

| Tool                          | Purpose                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `repo_inspect`                | Inspect a bounded file snapshot, generated sources, and capability metadata. |
| `repo_audit`                  | Run the exact CLI/Action policy engine on a snapshot, optionally diff-aware. |
| `release_status`              | Read API version/build/lifecycle metadata; unknown fields are null.          |
| `lsio.search_images`          | Search structured LinuxServer API metadata.                                  |
| `lsio.get_image`              | Fetch a normalized image record.                                             |
| `lsio.audit_image`            | Inspect supplied usage text using legacy project guidance.                   |
| `lsio.audit_compose`          | Audit LinuxServer services in Compose text.                                  |
| `lsio.list_categories`        | List available image categories.                                             |
| `lsio.get_known_issues`       | Read known-issue/status context.                                             |
| `lsio.search_image_requests`  | Research open/closed Image Requests.                                         |
| `lsio.pending_image_requests` | Open-request compatibility shortcut.                                         |
| `lsio.closed_image_requests`  | Closed-request compatibility shortcut.                                       |
| `lsio.recommended_new_images` | Compare available images and request history.                                |
| `lsio.prepare_image_request`  | Draft only; never submit.                                                    |
| `lsio.image_pipeline`         | Combine inventory, request history, and issues.                              |
| `lsio.get_support_links`      | Return community support/documentation links.                                |
| `lsio.validate_spec`          | Validate scaffold input.                                                     |
| `lsio.generate_scaffold`      | Return Dockerfile, Compose, and README starter text.                         |
| `lsio.get_guidance_links`     | Return official documentation references.                                    |
| `lsio.get_best_practices`     | Return project review checklists.                                            |
| `lsio.get_skillsets`          | Return community workflow profiles.                                          |
| `lsio.lookup_official_image`  | Check the structured API and optional docs text signals.                     |
| `lsio.audit_image_compliance` | Legacy artifact checklist and remediation scaffolds.                         |
| `lsio.generate_dockerfile`    | Return Dockerfile text and validation.                                       |
| `lsio.get_optimization_ideas` | Return project improvement ideas.                                            |

Remote repository tools accept files as data, not host paths or arbitrary repository URLs. CLI-local reading is not exposed through MCP.

Image requests remain best-effort, read-only public research. Optional GitHub authentication enriches Discussions metadata; no basic image/audit operation requires a token. Current matching is keyword-based, not a complete alias/semantic/feasibility system. Closed requests are checked before suggesting drafts, and incomplete searches are disclosed. No low-value comments or automatic submissions are encouraged.

## Safety and resource limits

Repository text is data, never instructions. Dockerfiles, YAML, scripts, and Compose are never executed. The core has no filesystem, hosting, or GitHub dependency.

| Boundary               | Limit                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Snapshot               | 256 files; 256,000 UTF-8 bytes/file; 2,000,000 bytes total.                                                           |
| Changed paths          | 500, including rename sources.                                                                                        |
| Analysis amplification | 1,000 findings; 256 consumed metadata items/services. Oversized analysis fails explicitly, never as a truncated pass. |
| Local discovery        | Relevant source directories only; 10,000 entries, depth 24, 15-second traversal budget; no repository symlinks.       |
| Worker request body    | 3,000,000 bytes, rejected before JSON parsing.                                                                        |
| API/docs client        | Allowlisted HTTPS origins, no redirects, 8-second timeout; 4 MB catalogue / 1 MB optional documentation response.     |
| Action GitHub reads    | Fixed HTTPS GitHub API, no redirects; 8 seconds/request, 1 MB/response, at most five file pages plus revision reads.  |

Structured API failures are errors, not empty successful catalogues or negative official-image lookups. Unknown lifecycle/capability fields remain unknown. New findings never include raw secret-bearing source lines. GitHub workflow-command values are escaped.

The legacy public Discussions/known-issue adapters remain best-effort sources, not authoritative policy or a complete supply-chain/security assessment. Multi-isolate rate limiting still requires a deliberate production design; the current Worker limiter is in-memory. See [SECURITY.md](SECURITY.md).

## Deployment and publishing

Nothing is deployed or published by importing this repository. Current metadata deliberately advertises no unverified remote endpoint.

- Configure real KV IDs in [wrangler.toml](wrangler.toml), then use root-local `npx wrangler` commands.
- Store optional GitHub read credentials as deployment secrets, preferably GitHub App credentials in a production design.
- Deploy the Worker, verify `/health` and `/mcp`, and build/deploy the UI with `VITE_API_BASE_URL` set to the actual Worker origin.
- Only then update the website/remote transport metadata in both `server.json` copies.

`LSIO_API_BASE_URL` is restricted to the official `https://api.linuxserver.io` origin; it is not an arbitrary proxy/SSRF escape hatch. `CACHE_TTL_SECONDS` accepts 1-86400 (default 3600). An optional `GITHUB_TOKEN` is used for public Discussion reads, never mutations.

`npm run release:check` validates the workspace; `npm run release:pack` previews the publishable package; `npm run release:sbom` emits a CycloneDX SBOM. CI validates the shipped Action bundle and dogfoods the Action. Dependency review, CodeQL, and Dependabot are configured separately.

The **Publish** workflow is manual and main-only. Prefer npm trusted publishing/OIDC; an npm publishing secret remains a fallback. GitHub Packages uses the repository's package-scoped token. Cloudflare deployment is separately opted in and requires configured IDs, credentials, and `VITE_API_BASE_URL`.

The npm package, MCP Registry, GitHub Packages, GHCR, GitHub Marketplace/App, and GitHub Releases are distinct. A repository migration transfers none of those automatically. See the [operational handover checklist](docs/transfer.md).

## Phases

- **Current foundation:** discovery/request research, policy v1, CLI, stdio/HTTP, read-only Action review, SARIF, fixtures, and protocol/adapter tests.
- **Remaining MVP depth:** broader authoritative metadata, repository/supply-chain inspection, alias/upstream-aware duplicate detection, and request feasibility. Add rules only with evidence and tests.
- **Beta:** GitHub App, custom Check Runs, richer PR explanations, authenticated reads, and exact-hash prepared operations. No write feature is implied by this roadmap.
- **Advanced:** only after authorization and approval tests, approved Discussions/meaningful comments, fork/PR preparation, policy synchronization, and organization adoption.

Any future mutation must prepare, validate, check duplicates/authorization, show the exact operation, obtain explicit human approval bound to its immutable hash, execute, and record the result. Modified operations invalidate approval. Workflow edits require additional scrutiny.

## Canonical migration and compatibility

`dev` is the default development branch. `main` is retained as the stable
baseline; development changes are not automatically promoted to it. CI and
CodeQL cover development changes, while publishing remains manual from `main`.

[blackoutsecure/linuxserver-mcp](https://github.com/blackoutsecure/linuxserver-mcp) consolidates `linuxserver-mcp-registry` at `7ad877a`, `blackoutsecure/linuxserver-mcp-server` at `eaa5b0c`, and `blackoutmode/linuxserver-mcp-server` at `6eb7188`, including its extra local checkout. All source histories and license notices are retained; originals were not deleted or archived.

Version 0.2.0 adds the policy/core interfaces and three tools without renaming the 22 legacy tools. `linuxserver-mcp` now accepts audit/review commands; no arguments still starts stdio. The installed aliases `linuxserver-mcp-registry` and `linuxserver-mcp-server`, and local `packages/mcp-server/dist/cli.js`, remain stdio-compatible. `dist/index.js` remains a library entry point.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Keep policy sources explicit, include valid/invalid fixtures, and preserve read-only defaults.

GPL-3.0 for the combined project; original MIT attribution remains in [NOTICE](NOTICE). The Action bundle retains third-party license notices next to its entry point. See [LICENSE](LICENSE).
