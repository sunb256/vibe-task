import { ChildProcessWithoutNullStreams } from "node:child_process";
import type {
  JsonRpcId,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from "../shared/types.js";
import { isRecord } from "../shared/types.js";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

export class JsonlTransport {
  private proc: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<JsonRpcId, PendingRequest>();
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private notificationHandlers: Array<
    (msg: JsonRpcNotification) => Promise<void> | void
  > = [];
  private serverRequestHandlers: Array<(msg: JsonRpcRequest) => Promise<void> | void> = [];

  // 子プロセスの入出力を購読してJSONL処理を初期化する。
  constructor(proc: ChildProcessWithoutNullStreams) {
    this.proc = proc;

    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      this.stdoutBuffer += chunk;
      this.drainStdout();
    });

    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (chunk: string) => {
      this.stderrBuffer += chunk;
      this.drainStderr();
    });

    proc.on("exit", (code, signal) => {
      this.drainStderr(true);
      const err = new Error(`codex app-server exited (code=${code}, signal=${signal})`);
      for (const [, pending] of this.pending) {
        pending.reject(err);
      }
      this.pending.clear();
    });
  }

  // 通知メッセージ受信用のハンドラを登録する。
  onNotification(handler: (msg: JsonRpcNotification) => Promise<void> | void): void {
    this.notificationHandlers.push(handler);
  }

  // サーバーリクエスト受信用のハンドラを登録する。
  onServerRequest(handler: (msg: JsonRpcRequest) => Promise<void> | void): void {
    this.serverRequestHandlers.push(handler);
  }

  // JSON-RPCリクエストを送信して結果Promiseを返す。
  async request(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    const payload: JsonRpcRequest = { id, method, params };
    this.write(payload);

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  // JSON-RPC成功応答を送信する。
  respond(id: JsonRpcId, result: unknown): void {
    this.write({ id, result });
  }

  // JSON-RPCエラー応答を送信する。
  respondError(id: JsonRpcId, code: number, message: string, data?: unknown): void {
    this.write({ id, error: { code, message, data } });
  }

  // JSON-RPC通知を送信する。
  notify(method: string, params?: unknown): void {
    this.write({ method, params });
  }

  // 子プロセスを終了してトランスポートを閉じる。
  close(): void {
    this.proc.kill();
  }

  // 1行JSONLとして標準入力へ書き込む。
  private write(obj: unknown): void {
    this.proc.stdin.write(`${JSON.stringify(obj)}\n`);
  }

  // 標準出力バッファを改行単位で分割して処理する。
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

  // 標準エラーを行単位で処理し、既知のPATH更新警告だけ抑制する。
  private drainStderr(flushRemainder = false): void {
    while (true) {
      const newlineIndex = this.stderrBuffer.indexOf("\n");
      if (newlineIndex < 0) {
        break;
      }

      const line = this.stderrBuffer.slice(0, newlineIndex);
      this.stderrBuffer = this.stderrBuffer.slice(newlineIndex + 1);
      this.forwardStderrLine(`${line}\n`);
    }

    if (flushRemainder && this.stderrBuffer) {
      this.forwardStderrLine(this.stderrBuffer);
      this.stderrBuffer = "";
    }
  }

  // 既知のノイズ警告を除き、stderr行をプレフィックス付きで転送する。
  private forwardStderrLine(line: string): void {
    const trimmed = line.trim();
    if (trimmed.startsWith("WARNING: proceeding, even though we could not update PATH:")) {
      return;
    }
    process.stderr.write(`[codex stderr] ${line}`);
  }

  // JSON-RPCメッセージ種別を判定して対応ハンドラへ振り分ける。
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
