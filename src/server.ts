import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SshClient } from "./ssh.js";
import { toMcpResult } from "./tools/common.js";
import { registerDockerTools } from "./tools/docker.js";
import { registerExecTool } from "./tools/exec.js";
import { registerFilesystemTools } from "./tools/filesystem.js";
import { registerGitTools } from "./tools/git.js";

export function createServer(ssh: SshClient): McpServer {
  const server = new McpServer({
    name: "ssh-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Returns pong to verify MCP connectivity.",
    },
    async () =>
      toMcpResult({
        success: true,
        data: { message: "pong" },
      }),
  );

  registerExecTool(server, ssh);
  registerFilesystemTools(server, ssh);
  registerDockerTools(server, ssh);
  registerGitTools(server, ssh);

  return server;
}
