#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { SshClient } from "./ssh.js";
import { runSetup } from "./setup.js";

loadDotenv({ path: resolveProjectPath(".env"), quiet: true });

function resolveProjectPath(fileName: string): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  return resolve(moduleDir, "..", fileName);
}

async function main(): Promise<void> {
  if (process.argv[2] === "setup") {
    await runSetup();
    return;
  }

  const ssh = new SshClient(loadConfig);
  const server = createServer(ssh);
  const transport = new StdioServerTransport();

  process.once("SIGINT", () => {
    ssh.disconnect();
    process.exit(0);
  });

  process.once("SIGTERM", () => {
    ssh.disconnect();
    process.exit(0);
  });

  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error.";
  console.error(JSON.stringify({ success: false, error: message }));
  process.exit(1);
});
