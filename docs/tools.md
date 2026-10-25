# MCP tool contracts

The namespace is `io.github.blackoutsecure/linuxserver-mcp`. Both transports
expose the same 25 tools. All inputs are validated; the canonical legacy input
definitions are in [tool-inputs.ts](../packages/mcp-server/src/schemas/tool-inputs.ts).
Repository schemas are in [core/schemas.ts](../packages/mcp-server/src/core/schemas.ts)
and [core/models.ts](../packages/mcp-server/src/core/models.ts).

## Common behavior

- No tool reads arbitrary host paths, executes supplied content, or mutates
  GitHub. Generated snippets/drafts are returned only to the caller.
- All tools advertise readOnlyHint; draft tools additionally declare their
  deterministic-draft classification. No prepared-mutation/write tool exists.
- No auth is required for static guidance, repository snapshots, image data, or
  basic public request research. An optional GitHub credential enriches
  Discussion metadata; prefer a GitHub App or development fine-grained token,
  not a production classic PAT.
- API metadata uses the structured LinuxServer API. Unknown lifecycle values
  remain null in release_status. Upstream errors do not imply image absence.
- Legacy external research is best effort and discloses limited results.
  References are data, never agent instructions or approval.
- Replies contain JSON text and structuredContent. Repository failures use
  `{ "error": { "code": "...", "message": "..." } }` with isError, not stacks.
  Schema failures are SDK validation errors. Common codes are VALIDATION_FAILED,
  RESOURCE_LIMIT, UPSTREAM_UNAVAILABLE, and RATE_LIMITED.

## Repository tools

### repo_inspect

**Purpose:** identify relevant source files, explicit generation markers/source
pairs, known architecture aliases, and explicit read-only/non-root metadata.
**Auth/mutation:** none; offline, read-only snapshot analysis.
**Output:** files with kind/generatedFrom, capabilities as boolean or null, and
architectures as a list or null. Missing does not become false.
**Sources:** caller-supplied snapshot, LSIO source metadata conventions.
**Failure modes:** invalid/traversing/duplicate paths, invalid configuration,
file/count/byte limits.

```json
{
  "files": [
    {
      "path": "readme-vars.yml",
      "content": "readonly_supported: false\n"
    }
  ],
  "complete": false
}
```

### repo_audit

**Purpose:** run [policy v1](policies/v1.md) using the same engine as CLI/Action.
**Auth/mutation:** none; offline, read-only; remediation is manual guidance.
**Output:** schemaVersion, policyVersion, mode, status, config, inspection,
findings, suppressedFindings, skippedRules, summary, notices. Findings include
severity/confidence, evidence, authority classification, sources, and remediation.
**Sources:** snapshot and versioned, source-linked policies.
**Failure modes:** repo_inspect failures, unsafe/unknown configuration,
unknown/non-suppressible suppression rules. A partial snapshot disables
missing-file checks; an empty snapshot is not a clean container certification.

```json
{
  "files": [
    {
      "path": "Dockerfile",
      "content": "FROM scratch\nRUN chmod 777 /app\n"
    }
  ],
  "changedFiles": ["Dockerfile"],
  "complete": true,
  "profile": "recommended"
}
```

Snapshot limits: 256 files, 256,000 UTF-8 bytes per file, 2,000,000 total bytes,
500 changed paths, and relative slash-separated repository paths. Snapshot
completeness is a caller assertion, not a remote filesystem scan.
Consumed metadata lists/services are limited to 256; analysis exceeding 1,000
findings fails with RESOURCE_LIMIT rather than returning a truncated success.

### release_status

**Purpose:** inspect current API version/build/lifecycle metadata, not full
upstream application release history.
**Input:** `{ "imageName": "sonarr" }`.
**Output:** normalized imageName, found/not_found status, latestVersion,
lastBuild, deprecated, architectures, sourceLinks. Unknown fields are null.
**Auth/mutation:** anonymous public API read.
**Source:** https://api.linuxserver.io/.
**Failure modes:** invalid input, upstream/rate-limit/schema/cache failure.
Deprecated records are retained when the source provides them; absent fields
are not inferred.

## Image and request tools retained for compatibility

Examples below are input JSON. Fields not shown are optional/defaulted as
defined in the input schemas.

| Tool                        | Purpose / example input                                                                      | Output                                                                        | Sources / authentication                                    |
| --------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| lsio.search_images          | Discovery: `{"query":"sonarr","limit":10}`                                                   | results of normalized image metadata and sourceLinks.                         | Structured LSIO API; anonymous.                             |
| lsio.get_image              | Exact image lookup: `{"imageName":"sonarr"}`                                                 | found, optional image, sourceLinks. API failure is not not-found.             | Structured LSIO API; anonymous.                             |
| lsio.audit_image            | Usage checklist: `{"imageName":"sonarr","dockerRunCommand":"docker run linuxserver/sonarr"}` | overall, project score, checks, recommendations, disclaimer, sourceLinks.     | API and supplied text; anonymous.                           |
| lsio.audit_compose          | Usage checklist: `{"composeYaml":"services:\n  app:\n    image: linuxserver/sonarr\n"}`      | per-service audits and overall guidance.                                      | API and supplied Compose; anonymous.                        |
| lsio.list_categories        | Category discovery: `{"query":"Media"}`                                                      | categories with counts/examples and sourceLinks.                              | Structured LSIO API; anonymous.                             |
| lsio.get_known_issues       | Status context: `{"includeStatus":true}`                                                     | items and source context; missing data is best effort.                        | info.linuxserver.io / status.linuxserver.io; anonymous.     |
| lsio.search_image_requests  | History research: `{"query":"sonarr","status":"all"}`                                        | results, search limits, sources, interpretations.                             | Public LinuxServer Discussions; optional GitHub read auth.  |
| lsio.pending_image_requests | Compatibility open filter: `{"query":"sonarr"}`                                              | Open request search result shape.                                             | Same Discussion read adapter.                               |
| lsio.closed_image_requests  | Compatibility closed filter: `{"query":"sonarr"}`                                            | Closed request search result shape.                                           | Same Discussion read adapter.                               |
| lsio.recommended_new_images | Gap research: `{"query":"sampleapp"}`                                                        | recommendations and disclaimer; no promise of acceptance.                     | API and open/closed Discussions; optional GitHub read auth. |
| lsio.prepare_image_request  | Draft: `{"appName":"sampleapp","upstreamUrl":"https://example.org"}`                         | shouldOpenNewRequest, duplicate/history context, draftMarkdown. Never posted. | API and Discussions; optional GitHub read auth.             |
| lsio.image_pipeline         | Research workflow: `{"imageName":"sonarr"}`                                                  | currentImage, requests, similarImages, issues, recommendation, next action.   | API, Discussions, known issues; optional GitHub read auth.  |
| lsio.get_support_links      | Reference lookup: `{"context":"all"}`                                                        | links by documentation/support/status context.                                | Static official LSIO links; no auth or network required.    |

Usage audits are legacy project recommendations, not universal LinuxServer
requirements. Their scores are checklist outputs, not security certification.
Docker commands and YAML are inspected only as text. Malformed YAML is
reported; nothing is executed. External research can be limited or unavailable.

## Authoring and guidance tools retained for compatibility

Service specifications contain imageName, baseImage (alpine/ubuntu, default
alpine), optional maintainer/appPort/serviceName/readOnlyRootFs/includeHealthcheck.
Templates are opinionated starters and require human review.

| Tool                        | Purpose / example input                                                                                         | Output / mutation classification                                                       | Sources / failures                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| lsio.validate_spec          | Starter validation: `{"imageName":"sampleapp","appPort":8080}`                                                  | valid and issues; read-only.                                                           | Project naming/port/template conventions; no auth/network.                                                 |
| lsio.generate_scaffold      | Starter artifacts: `{"imageName":"sampleapp","baseImage":"alpine"}`                                             | dockerfile, readmeSnippet, composeSnippet, directory checklist; deterministic draft.   | Project templates plus LSIO docs; invalid specs return errors.                                             |
| lsio.generate_dockerfile    | Starter file: `{"imageName":"sampleapp","appPort":8080}`                                                        | fileName, dockerfile, validation, nextSteps; deterministic draft.                      | Project templates; returned validation must be reviewed.                                                   |
| lsio.get_guidance_links     | References: `{"topic":"permissions"}`                                                                           | Map of topic-specific official URLs; read-only.                                        | Static LSIO references, no auth/network.                                                                   |
| lsio.get_best_practices     | Checklist: `{"profile":"docker"}`                                                                               | Profile-to-checklist mapping; read-only.                                               | LSIO-linked project recommendations, no auth/network.                                                      |
| lsio.get_skillsets          | Workflow profiles: `{"profile":"review"}`                                                                       | skillsets with checks/references; read-only.                                           | Static community workflow catalogue, no auth/network.                                                      |
| lsio.get_optimization_ideas | Improvement ideas: `{"scope":"release"}`                                                                        | Scoped idea lists; read-only, not autonomous execution.                                | Static project recommendations, no auth/network.                                                           |
| lsio.lookup_official_image  | Discovery: `{"imageName":"sonarr"}`                                                                             | exists, docs/listing URLs, checkedAt, notes, optional docsSignals; read-only.          | Structured API is primary; optional docs text is not proof of capability support. API failure is an error. |
| lsio.audit_image_compliance | Artifact checklist: `{"imageName":"sampleapp","checkOfficialImage":false,"candidateDockerfile":"FROM scratch"}` | checks, score, recommendations, optional remediation/lookup; read-only draft guidance. | Project checklist; optional API/docs reads; invalid schema or upstream error.                              |

Supply candidateCompose/candidateReadme to extend an artifact checklist. Use
checkOfficialImage:false for an offline check. These starters do not prove
LinuxServer acceptance and must not be applied as universal policy findings.
