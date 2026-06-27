import { Client } from "ssh2";
import type { ClientChannel } from "ssh2";
import type { SshConfig } from "./config.js";

export interface ExecOptions {
  cwd?: string;
  timeoutMs?: number;
}

export interface RemoteCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class SshClient {
  private client: Client | null = null;
  private connecting: Promise<Client> | null = null;
  private connected = false;
  private config: SshConfig | null = null;

  constructor(private readonly loadConfig: () => Promise<SshConfig>) {}

  async exec(command: string, options: ExecOptions = {}): Promise<RemoteCommandResult> {
    const startedAt = Date.now();
    const client = await this.connect();
    const fullCommand = options.cwd ? `cd -- ${shellQuote(options.cwd)} && ${command}` : command;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return new Promise<RemoteCommandResult>((resolve, reject) => {
      let settled = false;
      let stdout = "";
      let stderr = "";
      let exitCode = 0;
      let streamRef: ClientChannel | null = null;

      const finish = (result: RemoteCommandResult): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      const timer = setTimeout(() => {
        const duration = Date.now() - startedAt;
        stderr += `${stderr.length > 0 ? "\n" : ""}Command timed out after ${timeoutMs} ms.`;
        exitCode = 124;
        streamRef?.close();
        finish({ stdout, stderr, exitCode, duration });
      }, timeoutMs);

      client.exec(fullCommand, (error, stream) => {
        if (error) {
          clearTimeout(timer);
          reject(error);
          return;
        }

        streamRef = stream;

        stream.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
        });

        stream.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });

        stream.on("close", (code: number | null) => {
          if (!settled) {
            exitCode = code ?? exitCode;
            finish({
              stdout,
              stderr,
              exitCode,
              duration: Date.now() - startedAt,
            });
          }
        });

        stream.on("error", (streamError: Error) => {
          clearTimeout(timer);
          reject(streamError);
        });
      });
    });
  }

  disconnect(): void {
    this.client?.end();
    this.client = null;
    this.connecting = null;
    this.connected = false;
  }

  private async connect(): Promise<Client> {
    if (this.client && this.connected) {
      return this.client;
    }

    if (this.connecting) {
      return this.connecting;
    }

    const config = await this.getConfig();

    this.connecting = new Promise<Client>((resolve, reject) => {
      const client = new Client();

      const cleanup = (): void => {
        this.client = null;
        this.connected = false;
        this.connecting = null;
      };

      client
        .once("ready", () => {
          this.client = client;
          this.connected = true;
          this.connecting = null;
          resolve(client);
        })
        .once("error", (error) => {
          cleanup();
          reject(error);
        })
        .on("close", cleanup)
        .on("end", cleanup);

      client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey: config.privateKey,
        readyTimeout: 20_000,
      });
    });

    return this.connecting;
  }

  private async getConfig(): Promise<SshConfig> {
    this.config ??= await this.loadConfig();
    return this.config;
  }
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
