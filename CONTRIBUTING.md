# Contributing

Thank you for improving this community project.

1. Open an issue for significant behavior or public API changes.
2. Keep changes focused and preserve the community disclaimer.
3. Never add automatic GitHub discussion comments, reactions, plus-ones, or draft submission.
4. Validate untrusted input and never execute submitted Docker, Compose, or shell text.
5. Run `npm run lint`, `npm test`, and `npm run build` before opening a pull request.
6. Keep onboarding in the root README; detailed tool/policy contracts and important architectural decisions belong under docs/. Keep the package README focused on installation.
7. Preserve all existing MCP tool names across both transports and cover changes with focused tests.

Use public LinuxServer.io documentation as the basis for audit rules and include source links. Do not imply LinuxServer.io endorsement or that Blackout Secure speaks for LinuxServer.io.

New repository rules belong in the shared versioned core, not an interface.
Include valid/invalid fixtures, evidence locations, authority classification,
severity, and remediation assertions. Do not turn unknown capabilities into
unsupported capabilities. Generated source output must not be patched directly.

PR review is read-only. Do not add comments, Check Run mutations, prepared fixes,
or write modes without the separate least-privilege/exact-operation approval
design and tests described in the README.
