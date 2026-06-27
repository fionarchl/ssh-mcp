# SSH MCP Server

A local Model Context Protocol (MCP) server that lets an MCP-compatible AI client operate on a remote Linux server over SSH.

The server is designed for developer operations workflows: inspecting files, checking logs, restarting Docker containers, and running Git commands on a remote host without opening a manual SSH session.

```text
MCP client
  -> local ssh-mcp server
    -> SSH
      -> remote Linux host
```

## Security Warning

This project can execute commands, read files, write files, restart Docker containers, and pull code on a remote server.

That is powerful, and it is also risky. Do not connect this MCP server to a production machine, privileged SSH account, sensitive filesystem, or broad cloud environment unless you understand the security implications and have added controls appropriate for your use case.

Recommended precautions:

- Use a dedicated low-privilege SSH user.
- Use a dedicated SSH key for this MCP server.
- Restrict the SSH user to only the directories and commands it needs.
- Avoid running this as `root`.
- Avoid giving the SSH user passwordless unrestricted `sudo`.
- Prefer narrow tools such as `docker_logs`, `tail_file`, and `git_pull` over broad command execution.
- Review commands before allowing an AI agent to run them.
- Keep this server local and expose it only through stdio transport.

This is a developer tool, not a hardened production remote administration platform.

## Features

- MCP stdio server for local client launch
- Lazy SSH connection setup
- Reusable SSH connection across tool calls
- Structured JSON success and error responses
- Zod-based tool argument validation
- Remote command execution with timeout support
- Remote file read, write, tail, and directory listing tools
- Docker logs, restart, and container exec tools
- Git pull tool

## Prerequisites

Local machine:

- Node.js 24 or newer
- npm
- An MCP-compatible client that supports stdio servers
- SSH access to the remote host
- A private SSH key available on the local machine

Remote host:

- Linux or another Unix-like environment with a POSIX shell
- SSH server enabled
- The configured SSH user must have permission for the target files/directories
- `tail`, `ls`, `cat`, `printf`, and `base64` available for filesystem tools
- Docker installed only if using Docker tools
- Git installed only if using `git_pull`

Optional local tools:

- Standard `ssh` client for manual connectivity testing

## Tech Stack

- TypeScript
- Node.js 24+
- `@modelcontextprotocol/sdk`
- `ssh2`
- `zod`

No Python is used.

## Project Structure

```text
src/
  index.ts
  server.ts
  ssh.ts
  config.ts
  tools/
    common.ts
    exec.ts
    docker.ts
    git.ts
    filesystem.ts
```

## Installation

```bash
git clone https://github.com/fionarchl/ssh-mcp.git
cd ssh-mcp
npm install
npm run setup
npm run build
```

## Configuration

The recommended setup is the interactive setup command:

```bash
npm run setup
```

It asks for:

- SSH host or IP address
- SSH port
- SSH username
- Local private key path

Then it writes a local `.env` file in the project root. `.env` is ignored by git.

You can also create the file manually:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
SSH_HOST=192.0.2.10
SSH_PORT=22
SSH_USERNAME=deploy
SSH_PRIVATE_KEY_PATH=/absolute/path/to/private/key
```

The same values can also be provided as normal process environment variables through your shell, operating system, process manager, or MCP client configuration.

| Variable | Required | Description |
| --- | --- | --- |
| `SSH_HOST` | Yes | Remote server hostname or IP address |
| `SSH_PORT` | No | SSH port, defaults to `22` |
| `SSH_USERNAME` | Yes | SSH username |
| `SSH_PRIVATE_KEY_PATH` | Yes | Local path to the private key |

PowerShell session example:

```powershell
$env:SSH_HOST="192.0.2.10"
$env:SSH_PORT="22"
$env:SSH_USERNAME="deploy"
$env:SSH_PRIVATE_KEY_PATH="$HOME\.ssh\ssh_mcp_key"
```

macOS/Linux shell example:

```bash
export SSH_HOST="192.0.2.10"
export SSH_PORT="22"
export SSH_USERNAME="deploy"
export SSH_PRIVATE_KEY_PATH="$HOME/.ssh/ssh_mcp_key"
```

## MCP Client Setup

Build the project after setup:

```bash
npm run build
```

Then configure your MCP client to launch:

```bash
node /absolute/path/to/ssh-mcp/dist/index.js
```

Many MCP clients represent stdio servers with a command, arguments, and optional environment variables. A generic configuration looks like:

```json
{
  "mcpServers": {
    "ssh-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/ssh-mcp/dist/index.js"]
    }
  }
}
```

If you prefer not to use `.env`, provide the SSH values through the client's environment configuration:

```json
{
  "mcpServers": {
    "ssh-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/ssh-mcp/dist/index.js"],
      "env": {
        "SSH_HOST": "192.0.2.10",
        "SSH_PORT": "22",
        "SSH_USERNAME": "deploy",
        "SSH_PRIVATE_KEY_PATH": "/absolute/path/to/private/key"
      }
    }
  }
}
```

After configuring the server, ask your MCP client:

```text
Use the ssh-mcp ping tool.
```

If `ping` works, verify SSH:

```text
Use ssh-mcp exec to run whoami on the remote server.
```

## Tool Reference

All tools return structured JSON. Successful responses include `success: true`; failures include `success: false` and an `error` message.

### `ping`

Returns `pong`. This is useful for verifying MCP connectivity without opening an SSH connection.

### `exec`

Runs a command on the remote server.

Arguments:

```json
{
  "command": "whoami",
  "cwd": "/optional/working/directory",
  "timeout": 30000
}
```

Returns:

```json
{
  "success": true,
  "data": {
    "stdout": "deploy\n",
    "stderr": "",
    "exitCode": 0,
    "duration": 120
  }
}
```

### `read_file`

Reads a remote file.

```json
{
  "path": "/srv/app/.env.example"
}
```

### `write_file`

Writes content to a remote file.

```json
{
  "path": "/tmp/example.txt",
  "content": "hello\n"
}
```

### `tail_file`

Returns the last N lines of a remote file.

```json
{
  "path": "/var/log/syslog",
  "lines": 100
}
```

### `list_directory`

Runs `ls -la` for a remote path.

```json
{
  "path": "/srv/app"
}
```

### `docker_logs`

Returns recent logs for a Docker container.

```json
{
  "container": "app",
  "tail": 100
}
```

### `docker_restart`

Restarts a Docker container.

```json
{
  "container": "app"
}
```

### `docker_exec`

Runs a command inside a Docker container using `/bin/sh -lc`.

```json
{
  "container": "app",
  "command": "node --version"
}
```

### `git_pull`

Runs `git pull` in a remote repository.

```json
{
  "repo": "/srv/app",
  "branch": "main"
}
```

## Example Prompts

- "Use ssh-mcp ping."
- "Use ssh-mcp exec to run `hostname && uname -a` on the remote server."
- "Use ssh-mcp list_directory on `/srv/app`."
- "Use ssh-mcp read_file on `/srv/app/.env.example`."
- "Use ssh-mcp tail_file to show the last 100 lines of `/var/log/syslog`."
- "Use ssh-mcp docker_logs to show the last 100 logs for the `app` container."
- "Use ssh-mcp docker_restart to restart the `app` container."
- "Use ssh-mcp git_pull in `/srv/app`."

## Security Model

This project includes basic safety measures, but it is not a sandbox.

Current protections:

- Uses `ssh2` directly instead of spawning `ssh.exe`
- Uses stdio MCP transport instead of opening a network server
- Loads SSH configuration lazily so MCP health checks do not require credentials
- Reuses a single SSH connection instead of reconnecting for every command
- Validates tool arguments with `zod`
- Rejects path arguments containing NUL, newlines, or `..`
- Restricts Docker container names to a conservative character set
- Restricts Git branch names to a conservative character set
- Shell-quotes generated command fragments such as paths, container names, and branch names
- Returns structured errors instead of throwing uncaught exceptions

Important limitations:

- `exec` intentionally accepts arbitrary command strings.
- `docker_exec` intentionally accepts arbitrary command strings inside a container.
- `write_file` can overwrite files that the SSH user can access.
- Docker access may be equivalent to root access depending on the host configuration.
- An AI agent can make mistakes, misunderstand intent, or run commands with unintended side effects.

If you fork this for serious use, consider adding:

- Allowlisted commands
- Read-only mode
- Per-tool confirmation rules
- Audit logging
- Path allowlists
- Separate SSH users per environment
- Forced commands in `authorized_keys`
- Container allowlists
- Rate limits and command timeouts by tool

## Troubleshooting

### MCP server failed to connect

Run the built server manually:

```bash
node /absolute/path/to/ssh-mcp/dist/index.js
```

If it exits immediately, fix the printed startup error. If it stays running, the stdio server can be launched by your MCP client.

### `ping` works but SSH tools fail

MCP is connected, but SSH configuration is missing or invalid. Check your environment variables and test plain SSH:

```bash
ssh -i "$HOME/.ssh/ssh_mcp_key" deploy@192.0.2.10
```

### `Permission denied (publickey)`

The username, private key, or remote authorized keys are wrong. Confirm that the private key matches a public key installed for the configured remote user.

### Docker permission denied

The SSH user may not have Docker permissions. On many Linux hosts, this means adding the user to the `docker` group or configuring a narrower controlled sudo policy.

Be careful: Docker permissions can effectively grant root-level access on many systems.

### Command timed out

Pass a larger timeout to `exec`:

```json
{
  "command": "npm install",
  "cwd": "/srv/app",
  "timeout": 120000
}
```

Timeouts are capped at 300000 milliseconds.

## Responsible Use

Use this only on systems you own or are explicitly authorized to administer. Review the code, understand the permission model, and adapt it before using it around production workloads or sensitive data.

## License

ISC
