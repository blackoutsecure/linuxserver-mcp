# Deployment Guide

This document describes how to deploy the LinuxServer.io MCP Registry to GitHub, npm, and Cloudflare infrastructure.

## Overview

This monorepo contains:

- **MCP Server** (`packages/mcp-server/`): A Node.js-based Model Context Protocol server distributed via npm
- **Cloudflare Worker** (`worker/`): A Hono-based HTTP server for Streamable HTTP MCP protocol support
- **Web UI** (`apps/web/`): A React application deployed to Cloudflare Pages

## Prerequisites

1. **npm and Node.js >= 22**: Required for building and testing
2. **GitHub account with repository access**: For publishing and CI/CD
3. **npm account with publishing rights**: For publishing the MCP package to npmjs.org
4. **Cloudflare account**: For deploying Worker and Pages
5. **Cloudflare API token**: For automated deployments (with `account:read`, `workers:write`, `pages:build` permissions)

## Step 1: Set Up npm Publishing

### Create npm trusted publishing (recommended):

1. Go to your npm account settings: https://www.npmjs.com/settings/account
2. Enable "Automation tokens" (for CI/CD)
3. Create a new automation token with "Publish" permissions
4. In GitHub repository Settings → Secrets and variables → Actions → New repository secret
5. Add `NPM_TOKEN` with your npm automation token

### Alternative: npm credentials

If you prefer manual authentication:

```bash
npm login
```

## Step 2: Configure Cloudflare Deployment

### Create KV Namespace:

```bash
# Install or update Wrangler
npm install -g wrangler

# Create production KV namespace
wrangler kv:namespace create "CACHE"
# Output: KV namespace created with ID: xxxxx

# Create preview KV namespace
wrangler kv:namespace create "CACHE" --preview
# Output: KV namespace created with ID: yyyyy
```

### Update wrangler.toml:

Replace the placeholder KV IDs in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "xxxxx"          # Your production KV namespace ID
preview_id = "yyyyy"  # Your preview KV namespace ID
```

### Configure Cloudflare GitHub secrets:

In GitHub repository Settings → Secrets and variables → Actions:

1. **CLOUDFLARE_ACCOUNT_ID**: Your Cloudflare account ID
   - Find at: https://dash.cloudflare.com/profile/api-tokens

2. **CLOUDFLARE_API_TOKEN**: Create an API token
   - Go to: https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use template "Edit Cloudflare Workers" or create custom with:
     - `account.read`, `workers.write`, `pages.write` permissions
     - Include Account Resources for your account
     - Token name: "GitHub Actions"

## Step 3: Verify Environment Variables

The MCP server and Worker use these environment variables:

### MCP Server:

- `GITHUB_TOKEN` (optional): GitHub token for authenticated discussions API access
  - Required for production deployments to use richer image request search
  - Set as GitHub Secret in Actions if using

- `LSIO_API_BASE_URL` (optional): LinuxServer.io API endpoint
  - Default: `https://api.linuxserver.io`
  - Set in `wrangler.toml` [vars] section

### Cloudflare Worker:

- `CACHE`: KV Namespace binding (automatically configured)
- `LSIO_API_BASE_URL`: Configured in `wrangler.toml`
- `CACHE_TTL_SECONDS`: Cache time-to-live (default: 3600)
- `LOG_LEVEL`: Logging level (default: info)

## Step 4: Test Locally

### Build all packages:

```bash
npm run build
```

### Run tests:

```bash
npm test
```

### Lint and format:

```bash
npm run lint
npm run format
```

### Test MCP server:

```bash
npx @blackoutsecure/linuxserver-mcp-registry
```

The server reads environment variables and connects via stdio.

### Test Cloudflare Worker locally:

```bash
cd worker
wrangler dev
```

## Step 5: Publish to npm

### Manual publishing (one-time):

```bash
npm publish --workspace=@blackoutsecure/linuxserver-mcp-registry --provenance
```

### Automated publishing:

The GitHub Actions workflow (`.github/workflows/publish.yml`) automatically:

1. Runs on `main` branch pushes when `packages/mcp-server/package.json` or `server.json` changes
2. Runs linting, tests, and builds
3. Publishes to npm with provenance
4. Deploys Worker to Cloudflare
5. Deploys Web UI to Cloudflare Pages

To trigger manually:

```bash
# In GitHub UI: Actions → Publish → Run workflow
```

## Step 6: Deploy to Cloudflare

### Deploy manually:

**Worker:**

```bash
cd worker
wrangler deploy --env production
```

**Pages:**

```bash
cd apps/web
npm run build
# Then upload dist/ via Cloudflare Pages UI or CLI
```

### Deploy via GitHub Actions:

Ensure `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` secrets are set, then:

1. Push to main branch, or
2. Trigger workflow manually

The workflow will:

- Build all packages
- Publish MCP package to npm
- Deploy Worker (listens at `https://linuxserver-mcp-registry.blackoutsecure.workers.dev/mcp`)
- Deploy Pages (serves at `https://linuxserver-mcp-registry.pages.dev`)

## Step 7: Verify Deployments

### npm:

```bash
npm search @blackoutsecure/linuxserver-mcp-registry
npm view @blackoutsecure/linuxserver-mcp-registry
```

### MCP Server (stdio):

```bash
npx @blackoutsecure/linuxserver-mcp-registry
```

### Cloudflare Worker:

```bash
curl https://linuxserver-mcp-registry.blackoutsecure.workers.dev/health
```

### Cloudflare Pages:

Visit: https://linuxserver-mcp-registry.pages.dev

## Step 8: Register with MCP Registry

Once all deployments succeed:

1. Visit: https://github.com/modelcontextprotocol/servers/
2. Fork the repository
3. Add your `server.json` to the `servers/` directory
4. Submit a Pull Request with:
   - Your server.json file
   - Brief description in PR body
   - Confirmation that HTTP remote endpoint works

The server.json includes:

- **name**: `io.github.blackoutsecure/linuxserver-mcp-registry`
- **remotes**: HTTP endpoint for Streamable HTTP protocol
- **packages**: npm package information for stdio protocol

## Troubleshooting

### npm publish fails:

- Verify `NPM_TOKEN` is set as repository secret
- Ensure `packages/mcp-server/package.json` version matches `server.json` version
- Check npm account permissions

### Cloudflare deployment fails:

- Verify KV namespace IDs in `wrangler.toml`
- Verify `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are correct
- Check Cloudflare account quotas (Workers, Pages, KV)

### MCP server not responding:

- Verify Node.js >= 22
- Check environment variables (GITHUB_TOKEN, LSIO_API_BASE_URL)
- Test: `echo '{}' | npx @blackoutsecure/linuxserver-mcp-registry`

### Worker caching issues:

- Verify KV namespace is writable
- Check `CACHE_TTL_SECONDS` value
- Clear Cloudflare cache: https://dash.cloudflare.com/

## Versioning

Version is maintained in:

- `packages/mcp-server/package.json` (npm package version)
- `server.json` (MCP registry version)
- `package.json` (workspace version)

Keep these in sync when releasing updates.

## CI/CD Pipeline

The repository includes GitHub Actions workflows:

- **ci.yml**: Runs on every push and PR
  - Linting (eslint, prettier)
  - Tests
  - Builds

- **publish.yml**: Runs on changes or manual trigger
  - Full CI suite
  - npm publish with provenance
  - Cloudflare Worker deployment
  - Cloudflare Pages deployment

## Support

For issues or questions:

- GitHub Issues: https://github.com/blackoutsecure/linuxserver-mcp-registry/issues
- MCP Registry: https://github.com/modelcontextprotocol/servers/
- Cloudflare Docs: https://developers.cloudflare.com/
