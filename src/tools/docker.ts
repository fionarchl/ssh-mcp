import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SshClient } from "../ssh.js";
import { asFailure, quoted, requireOk, schemas, toMcpResult } from "./common.js";

const dockerLogsSchema = z.object({
  container: schemas.container,
  tail: schemas.tail,
});

const dockerRestartSchema = z.object({
  container: schemas.container,
});

const dockerExecSchema = z.object({
  container: schemas.container,
  command: schemas.command,
});

export function registerDockerTools(server: McpServer, ssh: SshClient): void {
  server.registerTool(
    "docker_logs",
    {
      title: "Docker Logs",
      description: "Returns recent logs for a remote Docker container.",
      inputSchema: {
        container: schemas.container,
        tail: schemas.tail,
      },
    },
    async (args) => {
      try {
        const { container, tail } = dockerLogsSchema.parse(args);
        const result = await ssh.exec(`docker logs --tail ${tail} ${quoted(container)}`);
        const failure = requireOk(result);

        return toMcpResult(
          failure ?? {
            success: true,
            data: { logs: result.stdout, stderr: result.stderr, exitCode: result.exitCode },
          },
        );
      } catch (error) {
        return toMcpResult(asFailure(error));
      }
    },
  );

  server.registerTool(
    "docker_restart",
    {
      title: "Docker Restart",
      description: "Restarts a remote Docker container.",
      inputSchema: { container: schemas.container },
    },
    async (args) => {
      try {
        const { container } = dockerRestartSchema.parse(args);
        const result = await ssh.exec(`docker restart ${quoted(container)}`);
        const failure = requireOk(result);

        return toMcpResult(
          failure ?? {
            success: true,
            data: { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode },
          },
        );
      } catch (error) {
        return toMcpResult(asFailure(error));
      }
    },
  );

  server.registerTool(
    "docker_exec",
    {
      title: "Docker Exec",
      description: "Executes a command inside a remote Docker container using /bin/sh -lc.",
      inputSchema: {
        container: schemas.container,
        command: schemas.command,
      },
    },
    async (args) => {
      try {
        const { container, command } = dockerExecSchema.parse(args);
        const result = await ssh.exec(`docker exec ${quoted(container)} /bin/sh -lc ${quoted(command)}`);
        const failure = requireOk(result);

        return toMcpResult(
          failure ?? {
            success: true,
            data: { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode },
          },
        );
      } catch (error) {
        return toMcpResult(asFailure(error));
      }
    },
  );
}
