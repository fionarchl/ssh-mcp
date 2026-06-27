import { readFile } from "node:fs/promises";

export interface SshConfig {
  host: string;
  port: number;
  username: string;
  privateKey: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePort(value: string | undefined): number {
  if (!value || value.trim().length === 0) {
    return 22;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SSH_PORT must be an integer between 1 and 65535.");
  }

  return port;
}

export async function loadConfig(): Promise<SshConfig> {
  const privateKeyPath = requireEnv("SSH_PRIVATE_KEY_PATH");
  const privateKey = await readFile(privateKeyPath, "utf8");

  return {
    host: requireEnv("SSH_HOST"),
    port: parsePort(process.env.SSH_PORT),
    username: requireEnv("SSH_USERNAME"),
    privateKey,
  };
}
