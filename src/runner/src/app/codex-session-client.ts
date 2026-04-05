import { JsonlTransport } from "../transport/jsonl-transport.js";
import { isRecord } from "../shared/types.js";

// unknown値をRecordへ安全に変換する。
function getRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

// ネストしたプロパティを順番に取り出す。
function getPath(value: unknown, ...keys: string[]): unknown {
  let current: unknown = value;

  for (const key of keys) {
    const record = getRecord(current);
    if (!record) return undefined;
    current = record[key];
  }

  return current;
}

export class CodexSessionClient {
  private readonly transport: JsonlTransport;

  private activeThreadId: string | null = null;
  private activeTurnId: string | null = null;
  private activeTurnDoneResolver: (() => void) | null = null;
  private activeTurnDonePromise: Promise<void> | null = null;

  constructor(transport: JsonlTransport) {
    this.transport = transport;
  }

  setActiveTurnId(turnId: string): void {
    this.activeTurnId = turnId;
  }

  resolveAndClearActiveTurn(): void {
    this.activeTurnDoneResolver?.();
    this.activeTurnDoneResolver = null;
    this.activeTurnDonePromise = null;
  }

  // 新規スレッドを開始してアクティブスレッドIDを保持する。
  async startThread(params: {
    cwd?: string;
    approvalPolicy?: string;
    sandbox?: string;
    model?: string;
    personality?: string;
    serviceName?: string;
  }): Promise<string> {
    const result = await this.transport.request("thread/start", params);
    const threadIdValue = getPath(result, "thread", "id");

    if (typeof threadIdValue !== "string") {
      throw new Error("thread/start returned no thread.id");
    }

    this.activeThreadId = threadIdValue;
    return threadIdValue;
  }

  // 既存スレッドを再開してアクティブスレッドIDを更新する。
  async resumeThread(threadId: string, params?: Record<string, unknown>): Promise<string> {
    const result = await this.transport.request("thread/resume", {
      threadId,
      ...(params ?? {}),
    });

    const resumedId = getPath(result, "thread", "id");
    if (typeof resumedId !== "string") {
      throw new Error("thread/resume returned no thread.id");
    }

    this.activeThreadId = resumedId;
    return resumedId;
  }

  // 入力テキストで新しいturnを開始する。
  async startTurn(inputText: string, overrides?: Record<string, unknown>): Promise<string> {
    if (!this.activeThreadId) {
      throw new Error("No active thread. Call startThread() first.");
    }

    this.activeTurnDonePromise = new Promise<void>((resolve) => {
      this.activeTurnDoneResolver = resolve;
    });

    const result = await this.transport.request("turn/start", {
      threadId: this.activeThreadId,
      input: [{ type: "text", text: inputText }],
      ...(overrides ?? {}),
    });

    const turnIdValue = getPath(result, "turn", "id");
    if (typeof turnIdValue !== "string") {
      throw new Error("turn/start returned no turn.id");
    }

    this.activeTurnId = turnIdValue;

    return turnIdValue;
  }

  // 現在のturn完了通知を待機する。
  async waitForTurnCompletion(): Promise<void> {
    if (!this.activeTurnDonePromise) {
      throw new Error("No active turn completion promise.");
    }

    await this.activeTurnDonePromise;
  }

  // 実行中turnへ追加指示を送る。
  async steer(text: string): Promise<void> {
    if (!this.activeThreadId || !this.activeTurnId) {
      throw new Error("No active thread/turn to steer.");
    }

    await this.transport.request("turn/steer", {
      threadId: this.activeThreadId,
      expectedTurnId: this.activeTurnId,
      input: [{ type: "text", text }],
    });
  }

  // 実行中turnへ割り込み要求を送る。
  async interrupt(): Promise<void> {
    if (!this.activeThreadId || !this.activeTurnId) return;
    await this.transport.request("turn/interrupt", {
      threadId: this.activeThreadId,
      turnId: this.activeTurnId,
    });
  }
}
