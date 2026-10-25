# ADR 0001: Shared engine and safe interfaces

## Decision

Keep `linuxserver-mcp` as the canonical identity. The product is a reusable
LinuxServer-aware deterministic engine; MCP and GitHub are interfaces, not
requirements for using the engine.

Start with a portable `core` module in the existing publishable package, plus
CLI and GitHub Action workspace adapters. Keep the established npm lockfile.
Separate packages or pnpm are justified only by a real distribution or
dependency-boundary requirement, not by filling a proposed directory tree.

The new repository policy engine owns versioned rules, normalized findings,
evidence, suppression, and text/JSON/GitHub/SARIF output. Both transports and
both local interfaces use it. Existing image/scaffold tools retain their
contracts and are explicitly project guidance, not universal LSIO policy.

## Boundaries

- Repository MCP tools accept bounded snapshots, never local paths.
- Only the local CLI/Action filesystem adapter reads an explicitly chosen
  repository. It does not execute files or follow symlinks.
- PR context is read through bounded GitHub API requests. No App, mutation
  endpoint, LLM, database, or automatic write path is introduced.
- Action annotations belong to the workflow check. A separate Check Runs
  client and GitHub App remain future work.
- Rules require source links and applicability. Missing capability metadata
  remains unknown; architectural differences are not inherently failures.
- GitHub App writes require a future exact-operation approval design and
  separate validation. A roadmap is not an implementation.

## Consequences

MCP-independent users can audit locally or in CI without hosted services or
AI. SARIF and GitHub annotations are projections of the same findings.
Generated-file changes are reported, never rewritten. Output does not claim
official LinuxServer approval or security certification.

Retain legacy tool names and no-argument stdio behavior. Adding audit commands
must not break existing npx or editor MCP configurations.

Production transfer must inventory repository/package ownership, MCP namespace,
GHCR, App installation and signing keys, Worker/domain, deployment credentials,
and CI environments. None is transferred by renaming a repository.
