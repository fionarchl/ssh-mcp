import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { shellQuote } from "../ssh.js";

export interface ToolSuccess<T extends object> {
  success: true;
  data: T;
}

export interface ToolFailure {
  success: false;
  error: string;
  stderr?: string;
  exitCode?: number;
}

export type StructuredToolResult<T extends object> = ToolSuccess<T> | ToolFailure;

const pathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine((value) => !/[\0\r\n]/u.test(value), "Path cannot contain control characters.")
  .refine((value) => !value.includes(".."), "Parent directory traversal is not allowed.");

const containerSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/u, "Invalid Docker container name.");

const commandSchema = z
  .string()
  .min(1)
  .max(8192)
  .refine((value) => !/[\0]/u.test(value), "Command cannot contain NUL bytes.");

export const schemas = {
  path: pathSchema,
  container: containerSchema,
  command: commandSchema,
  timeout: z.number().int().min(1_000).max(300_000).optional(),
  tail: z.number().int().min(1).max(10_000).default(100),
};

export function toMcpResult<T extends object>(
  result: StructuredToolResult<T>,
): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
    structuredContent: result as unknown as { [x: string]: unknown },
    isError: !result.success,
  };
}

export function asFailure(error: unknown, fallback = "Tool execution failed."): ToolFailure {
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }

  return { success: false, error: fallback };
}

export function requireOk(result: {
  stdout: string;
  stderr: string;
  exitCode: number;
}): ToolFailure | null {
  if (result.exitCode === 0) {
    return null;
  }

  return {
    success: false,
    error: "Remote command failed.",
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

export function quoted(value: string): string {
  return shellQuote(value);
}
