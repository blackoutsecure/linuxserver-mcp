# @blackoutsecure/linuxserver-mcp-registry

Community MCP stdio server for LinuxServer.io image discovery, documentation-derived container audits, and open/closed Image Request research.

Provided by Blackout Secure and sponsored by Blackout Secure for the LinuxServer.io community.

> Audit results are derived from public LinuxServer.io documentation and are intended as community guidance. They are not an official LinuxServer.io certification, support decision, or approval decision.

## Usage

### With npx:

```bash
npx @blackoutsecure/linuxserver-mcp-registry
```

### With environment variables:

```bash
GITHUB_TOKEN=your_token LSIO_API_BASE_URL=https://api.linuxserver.io npx @blackoutsecure/linuxserver-mcp-registry
```

### In Claude desktop client:

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "linuxserver": {
      "command": "npx",
      "args": ["@blackoutsecure/linuxserver-mcp-registry"],
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
- **Scope Needed**: `public_repo` for read-only access

### LSIO_API_BASE_URL (Optional)

- **Description**: LinuxServer.io API base URL
- **Default**: `https://api.linuxserver.io`
- **Required**: No

## Tools

See [parent README.md](../../README.md#mcp-tools) for complete tool list.

## Security

- No automatic GitHub comments, reactions, or submissions
- YAML parsing is safe (not executed)
- Docker commands are analyzed as text only (not executed)
- All external API access is read-only
