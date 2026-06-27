import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { parse } from "dotenv";

interface SetupConfig {
  SSH_HOST: string;
  SSH_PORT: string;
  SSH_USERNAME: string;
  SSH_PRIVATE_KEY_PATH: string;
}

export async function runSetup(): Promise<void> {
  const envPath = resolveProjectPath(".env");
  const existing = await readExistingEnv(envPath);
  const rl = createInterface({ input, output });

  try {
    output.write("SSH MCP setup\n\n");
    output.write(`This will write SSH settings to ${envPath}\n`);
    output.write("\n");

    const config: SetupConfig = {
      SSH_HOST: await askRequired(rl, "SSH host or IP", existing.SSH_HOST),
      SSH_PORT: await askWithDefault(rl, "SSH port", existing.SSH_PORT ?? "22"),
      SSH_USERNAME: await askRequired(rl, "SSH username", existing.SSH_USERNAME),
      SSH_PRIVATE_KEY_PATH: await askRequired(
        rl,
        "Private key path",
        existing.SSH_PRIVATE_KEY_PATH,
      ),
    };

    await assertPrivateKeyExists(config.SSH_PRIVATE_KEY_PATH);
    await writeFile(envPath, formatEnv(config), "utf8");
    output.write("\nSaved .env successfully.\n");
    output.write("Next: build the project and configure your MCP client to run dist/index.js.\n");
  } finally {
    rl.close();
  }
}

function resolveProjectPath(fileName: string): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = moduleDir.endsWith(`${separator()}dist`) || moduleDir.endsWith(`${separator()}src`)
    ? resolve(moduleDir, "..")
    : moduleDir;

  return resolve(projectRoot, fileName);
}

function separator(): "\\" | "/" {
  return process.platform === "win32" ? "\\" : "/";
}

async function readExistingEnv(envPath: string): Promise<Partial<SetupConfig>> {
  try {
    const content = await readFile(envPath, "utf8");
    return parse(content) as Partial<SetupConfig>;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function askRequired(
  rl: ReturnType<typeof createInterface>,
  label: string,
  currentValue: string | undefined,
): Promise<string> {
  while (true) {
    const answer = await askWithDefault(rl, label, currentValue);
    if (answer.trim().length > 0) {
      return answer.trim();
    }

    output.write(`${label} is required.\n`);
  }
}

async function askWithDefault(
  rl: ReturnType<typeof createInterface>,
  label: string,
  currentValue: string | undefined,
): Promise<string> {
  const suffix = currentValue ? ` [${currentValue}]` : "";
  const answer = await rl.question(`${label}${suffix}: `);
  return answer.trim().length > 0 ? answer.trim() : currentValue ?? "";
}

async function assertPrivateKeyExists(path: string): Promise<void> {
  try {
    await access(path, constants.R_OK);
  } catch {
    output.write(`\nWarning: private key was not readable at ${path}\n`);
    output.write("The value was still saved. Fix the path before using SSH tools.\n");
  }
}

function formatEnv(config: SetupConfig): string {
  return [
    "# Local SSH MCP configuration. Do not commit this file.",
    `SSH_HOST=${quoteEnv(config.SSH_HOST)}`,
    `SSH_PORT=${quoteEnv(config.SSH_PORT)}`,
    `SSH_USERNAME=${quoteEnv(config.SSH_USERNAME)}`,
    `SSH_PRIVATE_KEY_PATH=${quoteEnv(config.SSH_PRIVATE_KEY_PATH)}`,
    "",
  ].join("\n");
}

function quoteEnv(value: string): string {
  return JSON.stringify(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
