# GitHub Copilot Instructions

## Documentation Source of Truth
- Maintain public/project documentation in `README.md` only.
- Do not create additional `.md` files for release notes, changelog, process docs, or duplicates unless explicitly requested by maintainers.
- When documentation changes are needed, update `README.md` directly with concise, community-facing guidance.

## Project Context
This repository contains an MCP (Model Context Protocol) server designed to assist developers in creating LinuxServer.io (LSIO) style Docker images.

Primary LSIO sources for this project:
- Site: https://www.linuxserver.io/
- Documentation: https://docs.linuxserver.io/
- API docs: https://docs.linuxserver.io/API/
- CI environment (Jenkins): https://ci.linuxserver.io/
- Discord: https://linuxserver.io/discord
- Forums: https://discourse.linuxserver.io/
- FAQ: https://docs.linuxserver.io/FAQ/
- Non-root guidance: https://docs.linuxserver.io/misc/non-root/
- Read-only guidance: https://docs.linuxserver.io/misc/read-only/
- Support policy: https://docs.linuxserver.io/misc/support-policy/
- Containers 101: https://docs.linuxserver.io/general/containers-101/
- Container branding: https://docs.linuxserver.io/general/container-branding/
- Container customization: https://docs.linuxserver.io/general/container-customization/
- Container execution: https://docs.linuxserver.io/general/container-execution/
- Docker Compose: https://docs.linuxserver.io/general/docker-compose/
- How to get support: https://docs.linuxserver.io/general/how-to-get-support/
- Running containers: https://docs.linuxserver.io/general/running-our-containers/
- Split DNS: https://docs.linuxserver.io/general/split-dns/
- SWAG: https://docs.linuxserver.io/general/swag/
- Understanding PUID/PGID: https://docs.linuxserver.io/general/understanding-puid-and-pgid/
- Updating containers: https://docs.linuxserver.io/general/updating-our-containers/
- Volumes: https://docs.linuxserver.io/general/volumes/

The server provides guidance, templates, and validation for LSIO standards, including:
- Use of LSIO base images (Alpine/Ubuntu with s6-overlay)
- Required directory structure (`/config`, `/app`, `/defaults`)
- `PUID`/`PGID` environment variable support
- LSIO documentation templates
- Healthcheck and service supervision patterns
- Repository scaffolding for LSIO submissions (`GPL-3.0` license, README format, Dockerfile conventions)

## Copilot Behavior Requirements
When generating code, documentation, or examples in this repository, Copilot should:
1. Follow LSIO conventions by default unless explicitly instructed otherwise.
2. Prefer modular architecture that is easy to extend.
3. Focus on developer tooling and authoring assistance rather than container runtime behavior.
4. Generate templates and validation logic aligned with LSIO structure and standards.
5. Keep outputs practical for repository scaffolding and submission workflows.
6. Treat the LSIO links above as authoritative references when deciding conventions and examples.
7. Prefer explicit LSIO documentation-backed guidance when there is ambiguity.
8. Favor refactoring that removes redundancy and consolidates logic into shared functions/modules.
9. Use existing project utilities before adding new helpers.
10. Prioritize LinuxServer.io community standards when guidance conflicts with generic patterns.

## Documentation Mapping Rules
- For base image and init/service behavior, align with LSIO docs and s6-overlay patterns.
- For runtime permissions, prioritize non-root and PUID/PGID guidance.
- For filesystem and security posture, prioritize read-only and volumes guidance.
- For user-facing examples, prioritize Docker Compose, execution, and running-containers pages.
- For support/process language, align with FAQ and support-policy pages.
- For naming and presentation conventions, align with container-branding guidance.

## File Header and Comment Standards
- Add a short file header in project-owned source modules and workflows where comments are supported.
- Keep headers concise and structured with:
	- Project/module purpose
	- Standards basis (which LSIO docs area the file aligns to)
	- Approval status (community-aligned vs officially approved)
- Avoid noisy inline comments; prefer self-explanatory code and focused function names.
- Do not add license/copyright blocks unless explicitly requested.
- Keep comments factual and maintainable; avoid speculative implementation notes.

## MCP Tool Authoring Standards
- Keep tools single-purpose and predictable.
- Validate and sanitize tool inputs before processing.
- Return structured, parseable text payloads (JSON where appropriate).
- Expose actionable outputs (checklists, snippets, validation issues) over narrative-only responses.
- Include LSIO reference links in guidance-style tools when relevant.

## Code Quality and Reuse Standards
- Remove redundant code when touching a module; avoid parallel implementations of the same behavior.
- Prefer shared libraries/functions/types across tools to keep behavior consistent.
- Optimize for readability and maintainability first, then runtime efficiency where meaningful.
- Keep functions focused, avoid unnecessary abstraction, and ensure tests cover changed shared logic.

## Testing Standards
- Add and maintain automated tests for validation and scaffold generation behavior.
- Prefer Node.js built-in test runner for lightweight coverage unless additional framework capability is required.
- Cover expected success paths and key LSIO policy failures (naming, ports, required directories, guidance shape).
- Keep tests deterministic and fast for CI execution.
- Update tests when tool contracts or output schemas change.

## LSIO Best-Practice Review Checklist
- Confirm LSIO base image usage and s6-overlay assumptions.
- Confirm required directories are represented (`/config`, `/app`, `/defaults`) where applicable.
- Confirm `PUID`/`PGID` guidance and permissions posture are documented.
- Confirm read-only and volume guidance is addressed when filesystem behavior is impacted.
- Confirm examples are practical for compose/run workflows and support policy language is accurate.
- Confirm generated docs avoid claiming official LSIO endorsement unless explicitly approved.
- Confirm `npm test` passes before merge or release.

## Skillset and Tooling Usage Guidance
- When available, use workspace skills/tools relevant to the task domain.
- For Docker/container topics, prioritize LSIO docs listed in this file as the primary standards source.
- If specialized skills are unavailable for a requested domain, fall back to LSIO official docs and explicit project conventions.
- For review/refactor tasks, apply the LSIO review checklist before finalizing changes.
- For MCP ecosystem integrations, prefer official/community servers listed under https://github.com/mcp as the source of truth.
- For container-focused workflows, prefer skillsets/tools that cover Docker build, runtime, and Compose best practices where available.

## Implementation Priorities
- Prioritize maintainability and clear extension points.
- Keep components small and focused (template generation, validation, guidance).
- Ensure examples are opinionated toward LSIO best practices.
- Avoid introducing behavior unrelated to MCP server responsibilities.
- Prefer Node.js-first implementation patterns for MCP server runtime and tooling.
- Default to modern Node.js standards (ES modules, strict typing where used, and npm-based workflows).

## Scope Guardrails
Copilot should avoid:
- Recommending non-LSIO base image patterns unless explicitly requested.
- Overengineering runtime/container orchestration features.
- Diverging from LSIO docs/readme/dockerfile conventions by default.
- Claiming official LinuxServer.io approval/endorsement unless explicitly confirmed by LSIO maintainers.

## Output Style
- Be concise, actionable, and implementation-ready.
- Include concrete examples for Dockerfiles, README snippets, and scaffolded repo layouts where helpful.
- Default to standards-compliant, submission-friendly outputs.

## Runtime and Packaging Conventions
- Target Node.js 20+ compatibility.
- Use npm scripts for build, development, and start flows.
- Keep package metadata and publishing configuration compatible with GitHub Packages/Registry.
- Ensure MCP server entry points are executable in standard Node.js environments.

## Workspace and Dev Container Expectations
- Keep a repo-level dev container configuration for consistent onboarding.
- Ensure launch/bootstrap installs project dependencies (`npm ci`).
- Keep core CLI tooling available for contributors: Node.js 20+, npm, git, Docker CLI, Compose support, and GitHub CLI where possible.
- Keep setup deterministic and lightweight; avoid installing unnecessary global tooling.
