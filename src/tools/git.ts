import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SshClient } from "../ssh.js";
import { asFailure, quoted, requireOk, schemas, toMcpResult } from "./common.js";

const branchSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9._/-]+$/u, "Invalid branch name.")
  .refine((value) => !value.includes(".."), "Branch name cannot contain '..'.")
  .optional();

const gitPullSchema = z.object({
  repo: schemas.path,
  branch: branchSchema,
});

export function registerGitTools(server: McpServer, ssh: SshClient): void {
  server.registerTool(
    "git_pull",
    {
      title: "Git Pull",
      description: "Runs git pull in a remote repository.",
      inputSchema: {
        repo: schemas.path,
        branch: branchSchema,
      },
    },
    async (args) => {
      try {
        const { repo, branch } = gitPullSchema.parse(args);
        const command = branch
          ? `git -C ${quoted(repo)} pull origin ${quoted(branch)}`
          : `git -C ${quoted(repo)} pull`;
        const result = await ssh.exec(command);
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
