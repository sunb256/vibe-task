import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { JsonlTransport } from "./jsonl-transport.js";
import {
  handleNotificationMessage,
  type NotificationHandlerContext,
} from "./notification-handlers.js";
import { handleServerRequestMessage } from "./server-request-handlers.js";
import type { JsonRpcRequest } from "./types.js";
import { isRecord } from "./types.js";

function getRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function getPath(value: unknown, ...keys: string[]): unknown {
  let current: unknown = value;
  for (const key of keys) {
    const record = getRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
}

function display(value: unknown, fallback: string): string {
  return value === undefined || value === null ? fallback : String(value);
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

  constructor(transport: JsonlTransport) {
    this.transport = transport;
    this.notificationContext = {
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

  async waitForTurnCompletion(): Promise<void> {
    if (!this.activeTurnDonePromise) {
      throw new Error("No active turn completion promise.");
    }
    await this.activeTurnDonePromise;
  }

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

  async interrupt(): Promise<void> {
    if (!this.activeThreadId || !this.activeTurnId) return;
    await this.transport.request("turn/interrupt", {
      threadId: this.activeThreadId,
      turnId: this.activeTurnId,
    });
  }

  close(): void {
    this.rl.close();
    this.transport.close();
  }

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

  private normalizeAvailableDecisions(available: unknown, fallback: string[]): string[] {
    if (Array.isArray(available) && available.every((x) => typeof x === "string")) {
      return [...available];
    }
    return fallback;
  }

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

  private looksLikeReplyWanted(text: string): boolean {
    const t = text.trim();
    if (!t) return false;

    return (
      t.endsWith("?") ||
      t.endsWith("？") ||
      /答えてください|回答は|入力してください|選んでください|番号で答えて|A\/B\/C|1\/2\/3|どうぞ/.test(
        t
      )
    );
  }

  async continueConversationIfNeeded(): Promise<void> {
    while (true) {
      const text = this.lastAgentMessageText;
      if (!this.looksLikeReplyWanted(text)) {
        return;
      }

      console.log("\n[reply requested] Enterで終了、入力すると次の turn を開始します");
      const answer = (await this.rl.question("> ")).trim();

      if (!answer) {
        return;
      }

      this.lastAgentMessageText = "";
      await this.startTurn(answer);
      await this.waitForTurnCompletion();
    }
  }
}
