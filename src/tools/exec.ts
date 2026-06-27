import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SshClient } from "../ssh.js";
import { asFailure, schemas, toMcpResult } from "./common.js";

const execSchema = z.object({
  command: schemas.command,
  cwd: schemas.path.optional(),
  timeout: schemas.timeout,
});

export function registerExecTool(server: McpServer, ssh: SshClient): void {
  server.registerTool(
    "exec",
    {
      title: "Execute SSH Command",
      description: "Executes a validated command on the remote VM over SSH.",
      inputSchema: {
        command: schemas.command,
        cwd: schemas.path.optional(),
        timeout: schemas.timeout,
      },
    },
    async (args) => {
      try {
        const parsed = execSchema.parse(args);
        const options: { cwd?: string; timeoutMs?: number } = {};
        if (parsed.cwd !== undefined) {
          options.cwd = parsed.cwd;
        }
        if (parsed.timeout !== undefined) {
          options.timeoutMs = parsed.timeout;
        }

        const result = await ssh.exec(parsed.command, options);

        if (result.exitCode !== 0) {
          return toMcpResult({
            success: false,
            error: "Remote command failed.",
            stderr: result.stderr,
            exitCode: result.exitCode,
          });
        }

        return toMcpResult({ success: true, data: { ...result } });
      } catch (error) {
        return toMcpResult(asFailure(error));
      }
    },
  );
}
