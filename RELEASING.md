# Releasing

This project publishes packages to GitHub Packages and triggers release automation from GitHub Releases.

## One-time setup

1. Confirm package scope and publish target in `package.json`:
   - `name`: `@blackoutmode/linuxserver-mcp-server`
   - `publishConfig.registry`: `https://npm.pkg.github.com`
2. Ensure GitHub Actions has `packages: write` permission (already set in workflow).
3. Ensure repository ownership aligns with the package scope.

## Pre-release checklist

- [ ] Update version in `package.json`.
- [ ] Move release items from `CHANGELOG.md` `Unreleased` to a new version section.
- [ ] Run `npm ci`.
- [ ] Run `npm run build`.
- [ ] Run `npm test`.
- [ ] Confirm CI workflow passes on main.

## Release process

1. Commit release updates (`package.json`, `package-lock.json`, `CHANGELOG.md`).
2. Create a git tag (for example `v0.1.1`) and push it.
3. Create a GitHub Release and use `.github/release-template.md`.
4. On release publish, `.github/workflows/publish-github-packages.yml` publishes package artifacts.

## Manual publish fallback

If workflow publish is unavailable:

```bash
npm ci
npm run build
NODE_AUTH_TOKEN=<token-with-package-write> npm publish
```

## Post-release

- [ ] Verify package visibility in GitHub Packages.
- [ ] Verify README examples and badges.
- [ ] Create/refresh next `Unreleased` changelog section.

## Notes

- This is a community-aligned project for LinuxServer.io standards.
- Do not claim official LSIO approval unless maintainers explicitly confirm it.
