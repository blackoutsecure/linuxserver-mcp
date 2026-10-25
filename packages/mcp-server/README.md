# @blackoutsecure/linuxserver-mcp

Community policy/audit engine, CLI, and MCP server for LinuxServer.io image discovery, repository audits, request research, scaffolding, and guidance. Canonical source: [blackoutsecure/linuxserver-mcp](https://github.com/blackoutsecure/linuxserver-mcp).

Provided by Blackout Secure and sponsored by Blackout Secure for the LinuxServer.io community.

> Independent community tooling, not affiliated with, endorsed by, sponsored by, or maintained by LinuxServer.io. Findings are not certification or approval.

## Usage

Requires Node.js 22 or later. After the package has been published:

### With npx:

```bash
npx @blackoutsecure/linuxserver-mcp
```

### With environment variables:

```bash
GITHUB_TOKEN=your_token LSIO_API_BASE_URL=https://api.linuxserver.io npx @blackoutsecure/linuxserver-mcp
```

### In Claude desktop client:

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "linuxserver": {
      "command": "npx",
      "args": ["@blackoutsecure/linuxserver-mcp"],
      "env": {
        "GITHUB_TOKEN": "your_optional_github_token"
      }
    }
  }
}
```

## Environment Variables

### GITHUB_TOKEN (Optional)

- **Description**: GitHub personal access token for authenticated API access
- **Purpose**: Enables richer metadata when searching image requests via GitHub Discussions
- **Required**: No (gracefully degrades without it)
- **Security**: Mark as secret, never commit to repositories
- **Access Needed**: Read-only access to public discussion metadata; no mutation permissions are used.

### LSIO_API_BASE_URL (Optional)

- **Description**: LinuxServer.io API base URL
- **Default**: `https://api.linuxserver.io`
- **Required**: No
- **Boundary**: Only the official HTTPS origin is accepted, not arbitrary proxies or private-network URLs.

## Tools

The same 25 tools are available through stdio and the optional HTTP Worker. Existing names remain compatible. See the [tool contracts](https://github.com/blackoutsecure/linuxserver-mcp/blob/main/docs/tools.md).

The canonical command is `linuxserver-mcp`; the `linuxserver-mcp-registry` and `linuxserver-mcp-server` command aliases are retained. For a local build, run `node packages/mcp-server/dist/cli.js` from the repository root.

## CLI and shared core

No arguments still starts MCP. Auditing does not require MCP, AI, or GitHub:

```bash
linuxserver-mcp audit . --format text
linuxserver-mcp audit . --format json
linuxserver-mcp audit . --format sarif --output linuxserver-mcp.sarif
```

Exit codes: 0 completed, 1 configured finding threshold, 2 invalid input/runtime
error. Reports never overwrite existing files or modify repository sources.

Portable library consumers can import only the engine:

```js
import { auditRepository, toSarif } from '@blackoutsecure/linuxserver-mcp/core';

const report = auditRepository({
  files: [{ path: 'Dockerfile', content: 'FROM scratch\n' }],
  complete: false
});
const sarif = toSarif(report);
```

The core accepts bounded snapshots, not host paths. Unknown capabilities remain
null; every finding retains source, classification, evidence, and remediation.

## Security

- No automatic GitHub comments, reactions, or submissions
- YAML parsing is safe (not executed)
- Docker commands are analyzed as text only (not executed)
- All external API access is read-only

## License

GPL-3.0. The original MIT registry notice is retained in [NOTICE](NOTICE). See [LICENSE](LICENSE).
