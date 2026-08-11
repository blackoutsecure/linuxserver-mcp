# Security Policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub Security Advisories for this repository. Do not include tokens, private logs, or exploitable details in a public issue.

## Security boundaries

The service treats Compose YAML and Docker command input strictly as text and never executes it. GitHub access is read-only; no tool comments, reacts, plus-ones, or submits discussions. Optional tokens must be provided as deployment secrets and are never stored or logged.

Audit output is community guidance, not a security certification. Remove secrets and personal information from all submitted examples.
