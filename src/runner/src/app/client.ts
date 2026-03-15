import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { JsonlTransport } from "../transport/jsonl-transport.js";
import {
  handleNotificationMessage,
  type NotificationHandlerContext,
} from "./notification.js";
import { handleServerRequestMessage } from "./request.js";
import type { JsonRpcRequest } from "../shared/types.js";
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

// 表示用にunknown値を文字列へ変換する。
function display(value: unknown, fallback: string): string {
  return value === undefined || value === null ? fallback : String(value);
}

type ReplyWantedConfig = {
  suffixes?: string[];
  patterns?: string[];
};

type CodexAppServerClientOptions = {
  verbose?: boolean;
  replyWanted?: ReplyWantedConfig;
  replyMode?: "harfauto" | "fullauto";
  maxAutoReplyCount?: number;
};

const DEFAULT_REPLY_SUFFIXES = ["?", "？"];
const AUTO_REPLY_TEXT = "続けてください";
const MAX_AUTO_REPLY_COUNT = 3;
const DEFAULT_REPLY_PATTERNS = [
  "答えて",
  "回答は",
  "入力して",
  "選んで",
  "番号で答えて",
  "指定して",
  "教えて",
  "A/B/C",
  "1/2/3",
  "どうぞ",
];

// 既定ルールと設定ルールを重複なく統合する。
function mergeRules(value: string[] | undefined, fallback: string[]): string[] {
  const merged = [...fallback, ...(value ?? [])];
  return [...new Set(merged.map((rule) => rule.trim()).filter((rule) => rule.length > 0))];
}

// 返信判定パターン配列から正規表現を組み立てる。
function createReplyPattern(patterns: string[]): RegExp | null {
  if (patterns.length === 0) {
    return null;
  }
  try {
    return new RegExp(patterns.join("|"));
  } catch {
    return null;
  }
}

export class CodexAppServerClient {
  private transport: JsonlTransport;
  private rl = readline.createInterface({ input, output });

  private activeThreadId: string | null = null;
  private activeTurnId: string | null = null;
  private activeTurnDoneResolver: (() => void) | null = null;
  private activeTurnDonePromise: Promise<void> | null = null;

  private lastAgentMessageText = "";
  private streamingAgentTextByItemId = new Map<string, string>();
  private notificationContext: NotificationHandlerContext;
  private replySuffixes: string[];
  private replyPattern: RegExp | null;
  private replyMode: "harfauto" | "fullauto";
  private maxAutoReplyCount: number;

  // 通知処理と返信判定に必要な状態を初期化する。
  constructor(transport: JsonlTransport, options?: CodexAppServerClientOptions) {
    this.transport = transport;
    const verbose = options?.verbose === true;
    this.replySuffixes = mergeRules(options?.replyWanted?.suffixes, DEFAULT_REPLY_SUFFIXES);
    this.replyPattern = createReplyPattern(
      mergeRules(options?.replyWanted?.patterns, DEFAULT_REPLY_PATTERNS)
    );
    this.replyMode = options?.replyMode ?? "harfauto";
    this.maxAutoReplyCount = options?.maxAutoReplyCount ?? MAX_AUTO_REPLY_COUNT;
    this.notificationContext = {
      isVerbose: verbose,
      setActiveTurnId: (turnId) => {
        this.activeTurnId = turnId;
      },
      resolveAndClearActiveTurn: () => {
        this.activeTurnDoneResolver?.();
        this.activeTurnDoneResolver = null;
        this.activeTurnDonePromise = null;
      },
      setLastAgentMessageText: (text) => {
        this.lastAgentMessageText = text;
      },
      getStreamingAgentText: (itemId) => this.streamingAgentTextByItemId.get(itemId) ?? "",
      setStreamingAgentText: (itemId, text) => {
        this.streamingAgentTextByItemId.set(itemId, text);
      },
      deleteStreamingAgentText: (itemId) => {
        this.streamingAgentTextByItemId.delete(itemId);
      },
    };
    this.transport.onNotification((msg) =>
      handleNotificationMessage(msg, this.notificationContext)
    );
    this.transport.onServerRequest(this.handleServerRequest.bind(this));
  }

  // app-server へ初期化リクエストを送り接続を確立する。
  async initialize(): Promise<void> {
    await this.transport.request("initialize", {
      clientInfo: {
        name: "task-yml-runner",
        title: "Task YML Runner",
        version: "0.1.0",
      },
      capabilities: {
        // experimental requestUserInput / dynamic stuff に備えて true
        experimentalApi: true,
      },
    });

    this.transport.notify("initialized", {});
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

  // 入出力ハンドラを閉じて接続を終了する。
  close(): void {
    this.rl.close();
    this.transport.close();
  }

  // サーバー要求をrequestハンドラへ委譲する。
  private async handleServerRequest(msg: JsonRpcRequest): Promise<void> {
    await handleServerRequestMessage(msg, {
      askApproval: (args) => this.askApproval(args),
      normalizeAvailableDecisions: (available, fallback) =>
        this.normalizeAvailableDecisions(available, fallback),
      askToolUserInput: (params) => this.askToolUserInput(params),
      question: (query) => this.rl.question(query),
      respond: (id, result) => this.transport.respond(id, result),
      respondError: (id, code, message, data) =>
        this.transport.respondError(id, code, message, data),
    });
  }

  // 利用可能な承認選択肢を安全に正規化する。
  private normalizeAvailableDecisions(available: unknown, fallback: string[]): string[] {
    if (Array.isArray(available) && available.every((x) => typeof x === "string")) {
      return [...available];
    }
    return fallback;
  }

  // 承認リクエストを対話入力で処理する。
  private async askApproval(args: {
    title: string;
    summary: string;
    reason?: unknown;
    choices: string[];
  }): Promise<unknown> {
    console.log(`\n=== ${args.title} ===`);
    console.log(`summary: ${args.summary}`);

    if (args.reason) {
      console.log(`reason: ${String(args.reason)}`);
    }
    console.log(`choices: ${args.choices.join(", ")}`);

    while (true) {
      const answer = (
        await this.rl.question(`decision [${args.choices.join("/")}] > `)
      ).trim();

      if (!answer) continue;

      if (args.choices.includes(answer)) {
        return answer;
      }

      // execpolicy amendment を手入力できるようにする
      if (answer.startsWith("acceptWithExecpolicyAmendment ")) {
        const rest = answer.slice("acceptWithExecpolicyAmendment ".length).trim();
        const amendment = rest ? rest.split(/\s+/) : [];

        return {
          acceptWithExecpolicyAmendment: {
            execpolicy_amendment: amendment,
          },
        };
      }

      console.log("invalid decision");
    }
  }

  // requestUserInput要求に対して対話入力で回答を作る。
  private async askToolUserInput(params: unknown): Promise<unknown> {
    console.log("\n=== Tool requested user input ===");
    console.log(JSON.stringify(params, null, 2));

    const questionsValue = getPath(params, "questions");
    const questions = Array.isArray(questionsValue) ? questionsValue : [];

    if (questions.length > 0) {
      const answers: unknown[] = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const title =
          getPath(q, "label") ??
          getPath(q, "title") ??
          getPath(q, "question") ??
          getPath(q, "prompt") ??
          `Question ${i + 1}`;

        console.log(`\nQ${i + 1}: ${String(title)}`);

        const optionsValue = getPath(q, "options");
        const options = Array.isArray(optionsValue) ? optionsValue : [];
        let hasOther = false;

        if (options.length > 0) {
          options.forEach((opt, idx) => {
            if (typeof opt === "string") {
              console.log(`  ${idx + 1}. ${opt}`);
            } else {
              const label = getPath(opt, "label") ?? getPath(opt, "title") ?? JSON.stringify(opt);
              console.log(`  ${idx + 1}. ${String(label)}`);
              if (getPath(opt, "isOther")) hasOther = true;
            }
          });

          console.log("  o. other (free text)");
        }

        const raw = (await this.rl.question("> ")).trim();

        // 数字入力なら選択肢を返す
        const idx = Number(raw);
        if (raw && Number.isInteger(idx) && idx >= 1 && idx <= options.length) {
          const chosen = options[idx - 1];
          if (typeof chosen === "string") {
            answers.push(chosen);
          } else {
            answers.push(
              getPath(chosen, "value") ??
                getPath(chosen, "label") ??
                getPath(chosen, "title") ??
                chosen
            );
          }
          continue;
        }

        // "o" または自由入力を許す
        if (raw === "o" || raw === "other" || (!Number.isInteger(idx) && raw)) {
          // 相手が isOther を持っているなら素直に自由入力
          if (hasOther || options.length === 0) {
            const free =
              raw === "o" || raw === "other"
                ? await this.rl.question("free text > ")
                : raw;
            answers.push(free);
            continue;
          }

          // isOther が無いなら、無理に通すかどうかを選ぶ
          console.log(
            "This question may only accept listed options. Send raw free text anyway? [y/N]"
          );
          const confirm = (await this.rl.question("> ")).trim().toLowerCase();
          if (confirm === "y" || confirm === "yes") {
            answers.push(raw);
            continue;
          }

          throw new Error("User cancelled free-text response");
        }

        if (!raw) {
          answers.push("");
          continue;
        }

        throw new Error("Invalid input");
      }

      return { answers, response: answers };
    }

    const raw = await this.rl.question(
      'Paste JSON result for requestUserInput (empty = {"answers": []}): '
    );

    if (!raw.trim()) {
      return { answers: [] };
    }

    return JSON.parse(raw) as unknown;
  }

  // 最終メッセージが返信要求かどうかを判定する。
  private looksLikeReplyWanted(text: string): boolean {
    const t = text.trim();
    if (!t) return false;

    if (this.replySuffixes.some((suffix) => t.endsWith(suffix))) {
      return true;
    }

    return this.replyPattern?.test(t) ?? false;
  }

  // 返信要求が続く間は追加入力turnを繰り返す。
  async continueConversationIfNeeded(): Promise<void> {
    let autoReplyCount = 0;
    while (true) {
      const text = this.lastAgentMessageText;
      if (!this.looksLikeReplyWanted(text)) {
        return;
      }

      if (this.replyMode === "fullauto") {
        if (autoReplyCount >= this.maxAutoReplyCount) {
          console.log(
            `\n\n* 自動返信が ${this.maxAutoReplyCount} 回に達したため、次の task へ進みます\n`
          );
          return;
        }
        autoReplyCount += 1;
        console.log("\n\n* 自動返信で次の turn を開始します\n");
        console.log(`> ${AUTO_REPLY_TEXT}`);
        console.log("\n-----\n");
        this.lastAgentMessageText = "";
        await this.startTurn(AUTO_REPLY_TEXT);
        await this.waitForTurnCompletion();
        continue;
      }

      console.log(
        "\n\n* [質問] Enter or /skip で次へ\n"
      );
      const answer = (await this.rl.question("> ")).trim();

      if (!answer) {
        return;
      }

      if (answer === "/skip") {
        return;
      }
      console.log("\n-----\n");

      this.lastAgentMessageText = "";
      await this.startTurn(answer);
      await this.waitForTurnCompletion();
    }
  }
}
