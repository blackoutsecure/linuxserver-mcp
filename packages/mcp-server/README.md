# @blackoutsecure/linuxserver-mcp

Community MCP stdio server for LinuxServer.io image discovery, audits, image request research, container scaffolding, validation, and development guidance. Canonical source: [blackoutsecure/linuxserver-mcp](https://github.com/blackoutsecure/linuxserver-mcp).

Provided by Blackout Secure and sponsored by Blackout Secure for the LinuxServer.io community.

> Audit results are derived from public LinuxServer.io documentation and are intended as community guidance. They are not an official LinuxServer.io certification, support decision, or approval decision.

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

## Tools

The same 22 tools are available through stdio and the optional HTTP Worker. See the [canonical tool list](https://github.com/blackoutsecure/linuxserver-mcp#mcp-tools).

The canonical command is `linuxserver-mcp`; the `linuxserver-mcp-registry` and `linuxserver-mcp-server` command aliases are retained. For a local build, run `node packages/mcp-server/dist/cli.js` from the repository root.

## Security

- No automatic GitHub comments, reactions, or submissions
- YAML parsing is safe (not executed)
- Docker commands are analyzed as text only (not executed)
- All external API access is read-only

## License

GPL-3.0. The original MIT registry notice is retained in [NOTICE](NOTICE). See [LICENSE](LICENSE).
