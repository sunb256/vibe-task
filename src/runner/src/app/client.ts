import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { JsonlTransport } from "../transport/jsonl-transport.js";
import {
  handleNotificationMessage,
  type NotificationHandlerContext,
} from "./notification.js";
import { handleServerRequestMessage } from "./request.js";
import type { JsonRpcRequest } from "../shared/types.js";
import {
  ApprovalPrompter,
  parseApprovalDecisionInput,
} from "./approval-prompter.js";
import { ToolUserInputPrompter } from "./tool-user-input-prompter.js";
import {
  ReplyWantedDetector,
  type ReplyWantedConfig,
} from "./reply-wanted-detector.js";
import { CodexSessionClient } from "./codex-session-client.js";

type CodexAppServerClientOptions = {
  verbose?: boolean;
  replyWanted?: ReplyWantedConfig;
  replyMode?: "harfauto" | "fullauto";
  maxAutoReplyCount?: number;
};

const AUTO_REPLY_TEXT = "続けてください";
const MAX_AUTO_REPLY_COUNT = 3;

export { parseApprovalDecisionInput };

export class CodexAppServerClient {
  private readonly transport: JsonlTransport;
  private readonly rl = readline.createInterface({ input, output });
  private readonly sessionClient: CodexSessionClient;
  private readonly approvalPrompter: ApprovalPrompter;
  private readonly toolUserInputPrompter: ToolUserInputPrompter;
  private readonly replyWantedDetector: ReplyWantedDetector;

  private lastAgentMessageText = "";
  private streamingAgentTextByItemId = new Map<string, string>();
  private streamingDisplayEndsWithNewlineByItemId = new Map<string, boolean>();
  private spinnerTimer: ReturnType<typeof setInterval> | null = null;
  private spinnerMessage = "";
  private spinnerFrameIndex = 0;
  private spinnerVisible = false;
  private readonly spinnerFrames = ["|", "/", "-", "\\"];
  private readonly notificationContext: NotificationHandlerContext;

  private readonly replyMode: "harfauto" | "fullauto";
  private readonly maxAutoReplyCount: number;
  private readonly isVerbose: boolean;

  // 通知処理と返信判定に必要な状態を初期化する。
  constructor(transport: JsonlTransport, options?: CodexAppServerClientOptions) {
    this.transport = transport;
    this.sessionClient = new CodexSessionClient(transport);

    const verbose = options?.verbose === true;
    this.isVerbose = verbose;

    this.replyWantedDetector = new ReplyWantedDetector(options?.replyWanted);
    this.replyMode = options?.replyMode ?? "harfauto";
    this.maxAutoReplyCount = options?.maxAutoReplyCount ?? MAX_AUTO_REPLY_COUNT;

    this.approvalPrompter = new ApprovalPrompter({
      question: (query) => this.rl.question(query),
      clearProgressMessage: () => this.clearProgressMessage(),
    });

    this.toolUserInputPrompter = new ToolUserInputPrompter({
      question: (query) => this.rl.question(query),
      clearProgressMessage: () => this.clearProgressMessage(),
    });

    this.notificationContext = {
      isVerbose: verbose,
      setActiveTurnId: (turnId) => {
        this.sessionClient.setActiveTurnId(turnId);
      },
      resolveAndClearActiveTurn: () => {
        this.sessionClient.resolveAndClearActiveTurn();
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
      getStreamingDisplayEndsWithNewline: (itemId) =>
        this.streamingDisplayEndsWithNewlineByItemId.get(itemId) ?? false,
      setStreamingDisplayEndsWithNewline: (itemId, value) => {
        this.streamingDisplayEndsWithNewlineByItemId.set(itemId, value);
      },
      deleteStreamingDisplayEndsWithNewline: (itemId) => {
        this.streamingDisplayEndsWithNewlineByItemId.delete(itemId);
      },
      setProgressMessage: (message) => {
        this.setProgressMessage(message);
      },
      clearProgressMessage: () => {
        this.clearProgressMessage();
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
    return this.sessionClient.startThread(params);
  }

  // 既存スレッドを再開してアクティブスレッドIDを更新する。
  async resumeThread(threadId: string, params?: Record<string, unknown>): Promise<string> {
    return this.sessionClient.resumeThread(threadId, params);
  }

  // 入力テキストで新しいturnを開始する。
  async startTurn(inputText: string, overrides?: Record<string, unknown>): Promise<string> {
    return this.sessionClient.startTurn(inputText, overrides);
  }

  // 現在のturn完了通知を待機する。
  async waitForTurnCompletion(): Promise<void> {
    await this.sessionClient.waitForTurnCompletion();
  }

  // 実行中turnへ追加指示を送る。
  async steer(text: string): Promise<void> {
    await this.sessionClient.steer(text);
  }

  // 実行中turnへ割り込み要求を送る。
  async interrupt(): Promise<void> {
    await this.sessionClient.interrupt();
  }

  // 入出力ハンドラを閉じて接続を終了する。
  close(): void {
    this.clearProgressMessage();
    this.rl.close();
    this.transport.close();
  }

  // 非verbose時に進捗スピナーを表示する。
  private setProgressMessage(message: string): void {
    if (this.isVerbose || !process.stdout.isTTY) return;
    this.spinnerMessage = message;
    if (!this.spinnerTimer) {
      this.spinnerTimer = setInterval(() => {
        this.renderSpinner();
      }, 120);
    }
    this.renderSpinner();
  }

  // 進捗スピナーをクリアする。
  private clearProgressMessage(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }
    this.spinnerFrameIndex = 0;
    this.spinnerMessage = "";
    if (this.spinnerVisible && process.stdout.isTTY) {
      process.stdout.write("\r\x1b[2K");
    }
    this.spinnerVisible = false;
  }

  // スピナーの1フレームを描画する。
  private renderSpinner(): void {
    if (!process.stdout.isTTY || !this.spinnerMessage) return;
    const frame = this.spinnerFrames[this.spinnerFrameIndex % this.spinnerFrames.length] ?? "|";
    this.spinnerFrameIndex += 1;
    process.stdout.write(`\r${frame} ${this.spinnerMessage}`);
    this.spinnerVisible = true;
  }

  // サーバー要求をrequestハンドラへ委譲する。
  private async handleServerRequest(msg: JsonRpcRequest): Promise<void> {
    await handleServerRequestMessage(msg, {
      askApproval: (args) => this.approvalPrompter.askApproval(args),
      normalizeAvailableDecisions: (available, fallback) =>
        this.normalizeAvailableDecisions(available, fallback),
      askToolUserInput: (params) => this.toolUserInputPrompter.askToolUserInput(params),
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

  // 返信要求が続く間は追加入力turnを繰り返す。
  async continueConversationIfNeeded(): Promise<void> {
    let autoReplyCount = 0;

    while (true) {
      const text = this.lastAgentMessageText;
      if (!this.replyWantedDetector.looksLikeReplyWanted(text)) {
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

      console.log("\n\n* [質問] Enter or /skip で次へ\n");

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
