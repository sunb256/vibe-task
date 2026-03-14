import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { JsonlTransport } from "./jsonl-transport.js";
import type { JsonRpcNotification, JsonRpcRequest } from "./types.js";
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

  constructor(transport: JsonlTransport) {
    this.transport = transport;
    this.transport.onNotification(this.handleNotification.bind(this));
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

  private async handleNotification(msg: JsonRpcNotification): Promise<void> {
    const { method, params } = msg;

    switch (method) {
      case "thread/started":
        console.log(`[thread.started] ${display(getPath(params, "thread", "id"), "(unknown)")}`);
        return;

      case "turn/started": {
        console.log(`[turn.started] ${display(getPath(params, "turn", "id"), "(unknown)")}`);
        const maybeTurnId = getPath(params, "turn", "id");
        if (typeof maybeTurnId === "string") {
          this.activeTurnId = maybeTurnId;
        }
        return;
      }

      case "item/started": {
        const item = getRecord(getPath(params, "item"));
        const type = display(item?.type, "unknown");
        console.log(`\n[item.started] type=${type} id=${display(item?.id, "?")}`);

        if (type === "agentMessage" && typeof item?.id === "string") {
          this.streamingAgentTextByItemId.set(item.id, "");
        }

        if (type === "commandExecution") {
          const commandValue = item?.command;
          const command = Array.isArray(commandValue)
            ? commandValue.map((part) => String(part)).join(" ")
            : display(commandValue, "");
          if (command) console.log(`  command: ${command}`);
          if (item?.cwd) console.log(`  cwd: ${item.cwd}`);
        }
        return;
      }

      case "item/agentMessage/delta": {
        const itemId = getPath(params, "itemId");
        const delta = getPath(params, "delta") ?? getPath(params, "text") ?? "";
        if (delta) {
          const deltaText = String(delta);
          process.stdout.write(deltaText);
          if (typeof itemId === "string") {
            const prev = this.streamingAgentTextByItemId.get(itemId) ?? "";
            this.streamingAgentTextByItemId.set(itemId, prev + deltaText);
          }
        }
        return;
      }

      case "item/reasoning/textDelta":
        // raw reasoning は好みが分かれるのでデフォルトでは黙らせる
        return;

      case "item/commandExecution/outputDelta": {
        const chunk = getPath(params, "delta") ?? "";
        if (chunk) process.stdout.write(String(chunk));
        return;
      }

      case "item/fileChange/outputDelta":
        return;

      case "item/completed": {
        const item = getRecord(getPath(params, "item"));
        const type = display(item?.type, "unknown");
        console.log(`\n[item.completed] type=${type} status=${display(item?.status, "?")}`);

        if (type === "agentMessage") {
          const itemId = item?.id;
          const streamed =
            typeof itemId === "string" ? this.streamingAgentTextByItemId.get(itemId) ?? "" : "";
          const finalText = streamed || this.extractAgentText(item);

          this.lastAgentMessageText = finalText.trim();

          if (typeof itemId === "string") {
            this.streamingAgentTextByItemId.delete(itemId);
          }
        }

        if (type === "fileChange" && Array.isArray(item?.changes)) {
          console.log(`[fileChange] ${item.changes.length} change(s)`);
        }

        return;
      }

      case "serverRequest/resolved":
        console.log(
          `\n[serverRequest.resolved] requestId=${display(getPath(params, "requestId"), "?")} threadId=${display(getPath(params, "threadId"), "?")}`
        );
        return;

      case "turn/completed": {
        const turn = getPath(params, "turn");
        console.log(
          `[turn.completed] id=${display(getPath(turn, "id"), "?")} status=${display(getPath(turn, "status"), "?")}`
        );
        if (getPath(turn, "error")) {
          console.error("[turn.error]", JSON.stringify(getPath(turn, "error"), null, 2));
        }

        this.activeTurnId = null;
        this.activeTurnDoneResolver?.();
        this.activeTurnDoneResolver = null;
        this.activeTurnDonePromise = null;
        return;
      }

      case "error":
        console.error("[app-server error event]", JSON.stringify(params, null, 2));
        return;

      default:
        // 必要ならここを verbose にする
        // console.log("[notify]", method, JSON.stringify(params, null, 2));
        return;
    }
  }

  private async handleServerRequest(msg: JsonRpcRequest): Promise<void> {
    const { id, method, params } = msg;

    try {
      switch (method) {
        case "item/commandExecution/requestApproval": {
          const networkApprovalContext = getPath(params, "networkApprovalContext");
          const command = getPath(params, "command");
          const decision = await this.askApproval({
            title: "Command execution approval",
            reason: getPath(params, "reason"),
            summary: networkApprovalContext
              ? `network access to ${display(getPath(params, "networkApprovalContext", "host"), "unknown host")}`
              : Array.isArray(command)
                ? command.map((part) => String(part)).join(" ")
                : display(command, "(command unavailable)"),
            choices: this.normalizeAvailableDecisions(getPath(params, "availableDecisions"), [
              "accept",
              "acceptForSession",
              "decline",
              "cancel",
            ]),
          });

          this.transport.respond(id, decision);
          return;
        }

        case "item/fileChange/requestApproval": {
          const grantRoot = getPath(params, "grantRoot");
          const decision = await this.askApproval({
            title: "File change approval",
            reason: getPath(params, "reason"),
            summary: `itemId=${display(getPath(params, "itemId"), "?")}${grantRoot ? ` grantRoot=${String(grantRoot)}` : ""}`,
            choices: this.normalizeAvailableDecisions(getPath(params, "availableDecisions"), [
              "accept",
              "acceptForSession",
              "decline",
              "cancel",
            ]),
          });

          this.transport.respond(id, decision);
          return;
        }

        case "item/tool/requestUserInput": {
          const result = await this.askToolUserInput(params);
          this.transport.respond(id, result);
          return;
        }

        case "item/tool/call": {
          console.log("[item/tool/call] Dynamic tool call received.");
          console.log(JSON.stringify(params, null, 2));

          const raw = await this.rl.question(
            "Return tool result JSON (empty = decline with error): "
          );

          if (!raw.trim()) {
            this.transport.respondError(id, -32000, "User declined dynamic tool call");
            return;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(raw) as unknown;
          } catch {
            this.transport.respondError(id, -32602, "Invalid JSON for dynamic tool result");
            return;
          }

          this.transport.respond(id, parsed);
          return;
        }

        default: {
          console.log(`[server request] ${method}`);
          console.log(JSON.stringify(params, null, 2));

          const raw = await this.rl.question(
            "Unknown server request. Paste JSON result to send back, or empty for {}: "
          );

          if (!raw.trim()) {
            this.transport.respond(id, {});
            return;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(raw) as unknown;
          } catch {
            this.transport.respondError(id, -32602, "Invalid JSON");
            return;
          }

          this.transport.respond(id, parsed);
          return;
        }
      }
    } catch (err) {
      this.transport.respondError(
        id,
        -32000,
        err instanceof Error ? err.message : String(err)
      );
    }
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

  private extractAgentText(item: unknown): string {
    if (!item) return "";

    const itemRecord = getRecord(item);
    if (!itemRecord) return "";

    if (typeof itemRecord.text === "string") return itemRecord.text;
    if (typeof itemRecord.message === "string") return itemRecord.message;

    if (Array.isArray(itemRecord.content)) {
      return itemRecord.content
        .map((part) => {
          if (typeof part === "string") return part;
          const partRecord = getRecord(part);
          if (typeof partRecord?.text === "string") return partRecord.text;
          return "";
        })
        .join("");
    }

    return "";
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
