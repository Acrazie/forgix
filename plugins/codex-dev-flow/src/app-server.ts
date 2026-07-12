import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { buildRoutingSnapshot, createUnavailableRoutingSnapshot, type BuiltRoutingSnapshot } from "./routing.js";
import type { ModelId } from "./types.js";

export interface AppServerOptions {
  command?: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  config?: {
    plan?: string;
    planOverride?: string;
    multiplierOverride?: number;
    modelAllowlist?: readonly ModelId[];
    quota?: { warningPercent?: number; criticalPercent?: number };
  };
}

interface JsonRpcMessage {
  id?: number;
  method?: string;
  result?: unknown;
  error?: { code?: number; message?: string };
  params?: unknown;
}

export class AppServerError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class AppServerClient {
  private readonly process: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private nextId = 1;
  private closed = false;

  constructor(options: AppServerOptions = {}) {
    const args = options.args ?? ["app-server"];
    const spawnOptions = options.cwd
      ? { cwd: options.cwd, stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"] }
      : { stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"] };
    this.process = spawn(options.command ?? "codex", args, spawnOptions);
    const lines = createInterface({ input: this.process.stdout });
    lines.on("line", (line) => this.receive(line));
    this.process.on("error", (error) => this.fail(new AppServerError(error.message)));
    this.process.on("close", () => this.fail(new AppServerError("app-server closed before completing request")));
  }

  async readSnapshot(config?: AppServerOptions["config"]): Promise<BuiltRoutingSnapshot> {
    await this.request("initialize", {
      clientInfo: { name: "codex-dev-flow", title: "Codex Dev Flow", version: "0.1.0" }
    });
    this.notify("initialized", {});
    const account = await this.request("account/read", { refreshToken: false });
    const rateLimits = await this.request("account/rateLimits/read", {});
    const models = await this.request("model/list", { includeHidden: false });
    return buildRoutingSnapshot({ account, rateLimits, models, ...(config ? { config } : {}) });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.process.kill();
  }

  private notify(method: string, params: unknown): void {
    if (this.closed) throw new AppServerError("app-server is closed");
    this.process.stdin.write(JSON.stringify({ method, params }) + "\n");
  }

  private request(method: string, params: unknown): Promise<unknown> {
    if (this.closed) return Promise.reject(new AppServerError("app-server is closed"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.process.stdin.write(JSON.stringify({ id, method, params }) + "\n");
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new AppServerError("failed to write to app-server"));
      }
    });
  }

  private receive(line: string): void {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      return;
    }
    if (typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new AppServerError(message.error.message ?? "app-server request failed"));
      return;
    }
    pending.resolve(message.result);
  }

  private fail(error: AppServerError): void {
    if (this.closed) return;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

export interface CapturedRoutingSnapshot extends BuiltRoutingSnapshot {
  error?: string;
}

export async function captureRoutingSnapshot(options: AppServerOptions = {}): Promise<CapturedRoutingSnapshot> {
  const client = new AppServerClient(options);
  const timeoutMs = options.timeoutMs ?? 1500;
  try {
    return await withTimeout(client.readSnapshot(options.config), timeoutMs);
  } catch (error) {
    return {
      ...createUnavailableRoutingSnapshot(),
      error: error instanceof Error && error.message.toLowerCase().includes("timeout") ? "app-server timeout" : "app-server unavailable"
    };
  } finally {
    client.close();
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AppServerError("app-server timeout")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
