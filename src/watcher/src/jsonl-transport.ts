import { ChildProcessWithoutNullStreams } from "node:child_process";
import type {
  JsonRpcId,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from "./types.js";
import { isRecord } from "./types.js";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

export class JsonlTransport {
  private proc: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<JsonRpcId, PendingRequest>();
  private stdoutBuffer = "";
  private notificationHandlers: Array<
    (msg: JsonRpcNotification) => Promise<void> | void
  > = [];
  private serverRequestHandlers: Array<(msg: JsonRpcRequest) => Promise<void> | void> = [];

  constructor(proc: ChildProcessWithoutNullStreams) {
    this.proc = proc;

    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      this.stdoutBuffer += chunk;
      this.drainStdout();
    });

    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (chunk: string) => {
      // app-server の stderr は診断用としてそのまま出す
      process.stderr.write(`[codex stderr] ${chunk}`);
    });

    proc.on("exit", (code, signal) => {
      const err = new Error(`codex app-server exited (code=${code}, signal=${signal})`);
      for (const [, pending] of this.pending) {
        pending.reject(err);
      }
      this.pending.clear();
    });
  }

  onNotification(handler: (msg: JsonRpcNotification) => Promise<void> | void): void {
    this.notificationHandlers.push(handler);
  }

  onServerRequest(handler: (msg: JsonRpcRequest) => Promise<void> | void): void {
    this.serverRequestHandlers.push(handler);
  }

  async request(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    const payload: JsonRpcRequest = { id, method, params };
    this.write(payload);

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  respond(id: JsonRpcId, result: unknown): void {
    this.write({ id, result });
  }

  respondError(id: JsonRpcId, code: number, message: string, data?: unknown): void {
    this.write({ id, error: { code, message, data } });
  }

  notify(method: string, params?: unknown): void {
    this.write({ method, params });
  }

  close(): void {
    this.proc.kill();
  }

  private write(obj: unknown): void {
    this.proc.stdin.write(`${JSON.stringify(obj)}\n`);
  }

  private drainStdout(): void {
    while (true) {
      const newlineIndex = this.stdoutBuffer.indexOf("\n");
      if (newlineIndex < 0) break;

      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);

      if (!line) continue;

      let msg: unknown;
      try {
        msg = JSON.parse(line) as unknown;
      } catch {
        console.error("[transport] failed to parse JSONL line:", line);
        continue;
      }

      void this.dispatch(msg);
    }
  }

  private async dispatch(msg: unknown): Promise<void> {
    if (!isRecord(msg)) return;

    const hasId = "id" in msg;
    const method = msg.method;
    const hasMethod = typeof method === "string";

    // response: has id and no method
    if (hasId && !hasMethod) {
      const pending = this.pending.get(msg.id as JsonRpcId);
      if (!pending) return;

      this.pending.delete(msg.id as JsonRpcId);
      const response = msg as JsonRpcResponse;
      if (response.error) {
        pending.reject(new Error(`JSON-RPC ${response.error.code}: ${response.error.message}`));
      } else {
        pending.resolve(response.result);
      }
      return;
    }

    // server request: has id and method
    if (hasId && hasMethod) {
      const request: JsonRpcRequest = {
        id: msg.id as JsonRpcId,
        method,
        params: msg.params,
      };
      for (const handler of this.serverRequestHandlers) {
        await handler(request);
      }
      return;
    }

    // notification: has method and no id
    if (hasMethod) {
      const notification: JsonRpcNotification = {
        method,
        params: msg.params,
      };
      for (const handler of this.notificationHandlers) {
        await handler(notification);
      }
    }
  }
}
