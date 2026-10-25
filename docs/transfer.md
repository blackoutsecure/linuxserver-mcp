# Operational handover

This is a checklist for a future maintainer/organization transfer, not evidence
that packages, an App, or deployments already exist.

1. **Repository:** inventory owners, teams, branch/ruleset protections,
   environments, webhook settings, and pending PRs. Agree on a destination and
   perform an authorized GitHub transfer; do not bypass protected branches.
2. **npm:** transfer package ownership separately, retain existing versions,
   update trusted-publisher repository/workflow/environment settings, and verify
   provenance. Package namespace changes require a documented client migration.
3. **MCP Registry:** inventory publisher identity and the namespace in both
   server.json copies. Coordinate namespace ownership with registry maintainers;
   a GitHub redirect does not automatically transfer a publisher identity.
4. **GitHub Packages/GHCR:** inventory package permissions, repository links,
   consumers, retention, image tags/digests, SBOMs, and provenance. Update package
   access independently of source ownership.
5. **GitHub App, if implemented:** inventory App owner/name/slug, installation
   permissions, subscribed events, webhook URL/secret, signing keys, callback
   URLs, and user/installation token flows. Transfer ownership through the
   supported GitHub process; rotate secrets rather than copying them into Git.
6. **Cloudflare/domain:** inventory account, Worker/routes, KV IDs, Pages project,
   domain/DNS, limits, logs, and billing. Provision destination resources before
   changing verified remote URLs. Do not assume resources follow GitHub ownership.
7. **Secrets/signing:** use a secret manager, revoke old credentials, rotate
   webhook/deployment/signing material, and validate least-privilege/OIDC trusts.
   Do not put secret values in a handover document.
8. **CI/release:** update trusted environments and artifact attestations, run the
   full validation gate, inspect the Action bundle and package contents, and
   verify stdio/HTTP/CLI/Action behavior under the new owner.
9. **Clients:** document package/namespace/domain migrations, retain reviewed
   compatibility aliases, and test that old clients are not silently redirected
   to an unverified write target.

Only the currently verified repository URL should be advertised until the
destination package, registry entry, and remote endpoints have been validated.
