import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SshClient } from "../ssh.js";
import { asFailure, quoted, requireOk, schemas, toMcpResult } from "./common.js";

const readFileSchema = z.object({ path: schemas.path });

const writeFileSchema = z.object({
  path: schemas.path,
  content: z.string().max(10_000_000),
});

const tailFileSchema = z.object({
  path: schemas.path,
  lines: z.number().int().min(1).max(10_000).default(100),
});

const listDirectorySchema = z.object({ path: schemas.path });

export function registerFilesystemTools(server: McpServer, ssh: SshClient): void {
  server.registerTool(
    "read_file",
    {
      title: "Read Remote File",
      description: "Reads a file from the remote VM.",
      inputSchema: { path: schemas.path },
    },
    async (args) => {
      try {
        const { path } = readFileSchema.parse(args);
        const result = await ssh.exec(`cat -- ${quoted(path)}`);
        const failure = requireOk(result);

        return toMcpResult(
          failure ?? {
            success: true,
            data: { content: result.stdout, stderr: result.stderr, exitCode: result.exitCode },
          },
        );
      } catch (error) {
        return toMcpResult(asFailure(error));
      }
    },
  );

  server.registerTool(
    "write_file",
    {
      title: "Write Remote File",
      description: "Writes file contents to the remote VM.",
      inputSchema: {
        path: schemas.path,
        content: z.string().max(10_000_000),
      },
    },
    async (args) => {
      try {
        const { path, content } = writeFileSchema.parse(args);
        const encoded = Buffer.from(content, "utf8").toString("base64");
        const result = await ssh.exec(`printf %s ${quoted(encoded)} | base64 -d > ${quoted(path)}`);
        const failure = requireOk(result);

        return toMcpResult(
          failure ?? {
            success: true,
            data: { path, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode },
          },
        );
      } catch (error) {
        return toMcpResult(asFailure(error));
      }
    },
  );

  server.registerTool(
    "tail_file",
    {
      title: "Tail Remote File",
      description: "Returns the last N lines of a remote file.",
      inputSchema: {
        path: schemas.path,
        lines: z.number().int().min(1).max(10_000).default(100),
      },
    },
    async (args) => {
      try {
        const { path, lines } = tailFileSchema.parse(args);
        const result = await ssh.exec(`tail -n ${lines} -- ${quoted(path)}`);
        const failure = requireOk(result);

        return toMcpResult(
          failure ?? {
            success: true,
            data: { content: result.stdout, stderr: result.stderr, exitCode: result.exitCode },
          },
        );
      } catch (error) {
        return toMcpResult(asFailure(error));
      }
    },
  );

  server.registerTool(
    "list_directory",
    {
      title: "List Remote Directory",
      description: "Lists a remote directory with ls -la.",
      inputSchema: { path: schemas.path },
    },
    async (args) => {
      try {
        const { path } = listDirectorySchema.parse(args);
        const result = await ssh.exec(`ls -la -- ${quoted(path)}`);
        const failure = requireOk(result);

        return toMcpResult(
          failure ?? {
            success: true,
            data: { listing: result.stdout, stderr: result.stderr, exitCode: result.exitCode },
          },
        );
      } catch (error) {
        return toMcpResult(asFailure(error));
      }
    },
  );
}
