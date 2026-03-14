// src/app-server-runner.ts
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import YAML from "yaml";

type JsonRpcId = number | string;

type JsonRpcRequest = {
  id: JsonRpcId;
  method: string;
  params?: any;
};

type JsonRpcResponse = {
  id: JsonRpcId;
  result?: any;
  error?: { code: number; message: string; data?: any };
};

type JsonRpcNotification = {
  method: string;
  params?: any;
};

type TaskSpec = {
  id: string | number;
  action: string;
  cwd?: string;
  approval_policy?: string;
  sandbox?: string;
  model?: string;
};

type TaskFile = {
  task?: TaskSpec[];
  tasks?: TaskSpec[];
  defaults?: {
    cwd?: string;
    approval_policy?: string;
    sandbox?: string;
    model?: string;
  };
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class JsonlTransport {
  private proc: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<
    JsonRpcId,
    { resolve: (value: any) => void; reject: (err: Error) => void }
  >();
  private stdoutBuffer = "";
  private notificationHandlers: Array<(msg: JsonRpcNotification) => Promise<void> | void> = [];
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

  async request(method: string, params?: any): Promise<any> {
    const id = this.nextId++;
    const payload: JsonRpcRequest = { id, method, params };
    this.write(payload);

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  respond(id: JsonRpcId, result: any): void {
    this.write({ id, result });
  }

  respondError(id: JsonRpcId, code: number, message: string, data?: any): void {
    this.write({ id, error: { code, message, data } });
  }

  notify(method: string, params?: any): void {
    this.write({ method, params });
  }

  close(): void {
    this.proc.kill();
  }

  private write(obj: any): void {
    this.proc.stdin.write(`${JSON.stringify(obj)}\n`);
  }

  private drainStdout(): void {
    while (true) {
      const newlineIndex = this.stdoutBuffer.indexOf("\n");
      if (newlineIndex < 0) break;

      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);

      if (!line) continue;

      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch (err) {
        console.error("[transport] failed to parse JSONL line:", line);
        continue;
      }

      void this.dispatch(msg);
    }
  }

  private async dispatch(msg: any): Promise<void> {
    // response: has id and no method
    if ("id" in msg && !("method" in msg)) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;

      this.pending.delete(msg.id);
      const response = msg as JsonRpcResponse;
      if (response.error) {
        pending.reject(
          new Error(`JSON-RPC ${response.error.code}: ${response.error.message}`)
        );
      } else {
        pending.resolve(response.result);
      }
      return;
    }

    // server request: has id and method
    if ("id" in msg && "method" in msg) {
      for (const handler of this.serverRequestHandlers) {
        await handler(msg as JsonRpcRequest);
      }
      return;
    }

    // notification: has method and no id
    if ("method" in msg) {
      for (const handler of this.notificationHandlers) {
        await handler(msg as JsonRpcNotification);
      }
    }
  }
}

class CodexAppServerClient {
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
    const threadId = result?.thread?.id;
    if (!threadId) throw new Error("thread/start returned no thread.id");
    this.activeThreadId = threadId;
    return threadId;
  }

  async resumeThread(threadId: string, params?: Record<string, unknown>): Promise<string> {
    const result = await this.transport.request("thread/resume", {
      threadId,
      ...(params ?? {}),
    });
    const resumedId = result?.thread?.id;
    if (!resumedId) throw new Error("thread/resume returned no thread.id");
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

    const turnId = result?.turn?.id;
    if (!turnId) throw new Error("turn/start returned no turn.id");
    this.activeTurnId = turnId;

    return turnId;
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
        console.log(`[thread.started] ${params?.thread?.id ?? "(unknown)"}`);
        return;

      case "turn/started":
        console.log(`[turn.started] ${params?.turn?.id ?? "(unknown)"}`);
        this.activeTurnId = params?.turn?.id ?? this.activeTurnId;
        return;

      case "item/started": {
        const item = params?.item;
        const type = item?.type ?? "unknown";
        console.log(`\n[item.started] type=${type} id=${item?.id ?? "?"}`);

        if (type === "agentMessage" && item?.id) {
          this.streamingAgentTextByItemId.set(item.id, "");
        }

        if (type === "commandExecution") {
          const command = Array.isArray(item?.command)
            ? item.command.join(" ")
            : item?.command;
          if (command) console.log(`  command: ${command}`);
          if (item?.cwd) console.log(`  cwd: ${item.cwd}`);
        }
        return;
      }

      case "item/agentMessage/delta": {
        const itemId = params?.itemId;
        const delta = params?.delta ?? params?.text ?? "";
        if (delta) {
          process.stdout.write(String(delta));
          if (itemId) {
            const prev = this.streamingAgentTextByItemId.get(itemId) ?? "";
            this.streamingAgentTextByItemId.set(itemId, prev + String(delta));
          }
        }
        return;
      }

      case "item/reasoning/textDelta":
        // raw reasoning は好みが分かれるのでデフォルトでは黙らせる
        return;

      case "item/commandExecution/outputDelta": {
        const chunk = params?.delta ?? "";
        if (chunk) process.stdout.write(String(chunk));
        return;
      }

      case "item/fileChange/outputDelta":
        return;

      case "item/completed": {
        const item = params?.item;
        const type = item?.type ?? "unknown";
        console.log(`\n[item.completed] type=${type} status=${item?.status ?? "?"}`);

        if (type === "agentMessage") {
          const itemId = item?.id;
          const streamed = itemId
            ? this.streamingAgentTextByItemId.get(itemId) ?? ""
            : "";
          const finalText = streamed || this.extractAgentText(item);

          this.lastAgentMessageText = finalText.trim();

          if (itemId) {
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
          `\n[serverRequest.resolved] requestId=${params?.requestId ?? "?"} threadId=${params?.threadId ?? "?"}`
        );
        return;

      case "turn/completed": {
        const turn = params?.turn;
        console.log(`[turn.completed] id=${turn?.id ?? "?"} status=${turn?.status ?? "?"}`);
        if (turn?.error) {
          console.error("[turn.error]", JSON.stringify(turn.error, null, 2));
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
          const decision = await this.askApproval({
            
            title: "Command execution approval",
            reason: params?.reason,
            
            summary:
              params?.networkApprovalContext
                ? `network access to ${params?.networkApprovalContext?.host ?? "unknown host"}`
                : Array.isArray(params?.command)
                  ? params.command.join(" ")
                  : params?.command ?? "(command unavailable)",
            
            choices: this.normalizeAvailableDecisions(params?.availableDecisions, [
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
          const decision = await this.askApproval({

            title: "File change approval",
            reason: params?.reason,
            
            summary: `itemId=${params?.itemId ?? "?"}${params?.grantRoot 
                       ? ` grantRoot=${params.grantRoot}`
                       : ""}`,
            
            choices: this.normalizeAvailableDecisions(params?.availableDecisions, [
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

          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            this.transport.respondError(id, -32602, "Invalid JSON for dynamic tool result");
            return;
          }

          this.transport.respond(id, parsed);
          return;
        }

        default:
          console.log(`[server request] ${method}`);
          console.log(JSON.stringify(params, null, 2));

          const raw = await this.rl.question(
            "Unknown server request. Paste JSON result to send back, or empty for {}: "
          );

          if (!raw.trim()) {
            this.transport.respond(id, {});
            return;
          }

          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            this.transport.respondError(id, -32602, "Invalid JSON");
            return;
          }

          this.transport.respond(id, parsed);
          return;
      }
    } catch (err) {
      this.transport.respondError(
        id,
        -32000,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  private normalizeAvailableDecisions(
    available: unknown,
    fallback: string[]
  ): string[] {
    if (Array.isArray(available) && available.every((x) => typeof x === "string")) {
      return [...available];
    }
    return fallback;
  }

  private async askApproval(args: {
    title: string;
    summary: string;
    reason?: string;
    choices: string[];
  }): Promise<any> {
    
    console.log(`\n=== ${args.title} ===`);
    console.log(`summary: ${args.summary}`);

    if (args.reason) {
      console.log(`reason: ${args.reason}`);
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

  private async askToolUserInput(params: any): Promise<any> {
    console.log("\n=== Tool requested user input ===");
    console.log(JSON.stringify(params, null, 2));

    const questions = Array.isArray(params?.questions) ? params.questions : [];

    if (questions.length > 0) {
      const answers: any[] = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const title =
          q?.label ?? q?.title ?? q?.question ?? q?.prompt ?? `Question ${i + 1}`;

        console.log(`\nQ${i + 1}: ${title}`);

        const options = Array.isArray(q?.options) ? q.options : [];
        let hasOther = false;

        if (options.length > 0) {
          options.forEach((opt: any, idx: number) => {
            if (typeof opt === "string") {
              console.log(`  ${idx + 1}. ${opt}`);
            } else {
              const label = opt?.label ?? opt?.title ?? JSON.stringify(opt);
              console.log(`  ${idx + 1}. ${label}`);
              if (opt?.isOther) hasOther = true;
            }
          });

          console.log("  o. other (free text)");
        }

        const raw = (await this.rl.question("> ")).trim();

        // 数字入力なら選択肢を返す
        const idx = Number(raw);
        if (raw && Number.isInteger(idx) && idx >= 1 && idx <= options.length) {
          const chosen = options[idx - 1];
          answers.push(
            typeof chosen === "string"
              ? chosen
              : chosen?.value ?? chosen?.label ?? chosen?.title ?? chosen
          );
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
      "Paste JSON result for requestUserInput (empty = {\"answers\": []}): "
    );

    if (!raw.trim()) {
      return { answers: [] };
    }

    return JSON.parse(raw);
  }

  private extractAgentText(item: any): string {
    if (!item) return "";

    if (typeof item.text === "string") return item.text;
    if (typeof item.message === "string") return item.message;

    if (Array.isArray(item?.content)) {
      return item.content
        .map((part: any) => {
          if (typeof part === "string") return part;
          if (typeof part?.text === "string") return part.text;
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
      /答えてください|回答は|入力してください|選んでください|番号で答えて|A\/B\/C|1\/2\/3|どうぞ/.test(t)
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

  // async continueConversationIfNeeded(): Promise<void> {
  //   while (true) {
  //     const text = this.lastAgentMessageText.trim();
  //     if (!text) return;

  //     console.log("\n[continue] Enterで次のtaskへ / 入力すると次の turn を開始します");
  //     const answer = (await this.rl.question("> ")).trim();

  //     if (!answer) {
  //       return;
  //     }

  //     this.lastAgentMessageText = "";
  //     await this.startTurn(answer);
  //     await this.waitForTurnCompletion();
  //   }
  // }

}

async function loadTasks(taskFilePath: string): Promise<{
  tasks: TaskSpec[];
  defaults: NonNullable<TaskFile["defaults"]>;
}> {
  const raw = await fs.readFile(taskFilePath, "utf8");
  const parsed = YAML.parse(raw) as TaskFile;

  const tasks = parsed.tasks ?? parsed.task ?? [];
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("task.yml must contain 'task:' or 'tasks:' array");
  }

  const defaults = parsed.defaults ?? {};
  return { tasks, defaults };
}

async function main(): Promise<void> {

  const taskFilePath = process.argv[2] ?? "task.yml";
  const absTaskFilePath = path.resolve(taskFilePath);
  const { tasks, defaults } = await loadTasks(absTaskFilePath);

  const proc = spawn("codex", ["app-server", "--listen", "stdio://"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  const transport = new JsonlTransport(proc);
  const client = new CodexAppServerClient(transport);

  try {
    await client.initialize();

    // thread は 1 run 全体で共有
    const firstTaskCwd =
      tasks[0]?.cwd ??
      defaults.cwd ??
      process.cwd();

    const threadId = await client.startThread({
      cwd: firstTaskCwd,
      approvalPolicy: tasks[0]?.approval_policy ?? defaults.approval_policy ?? "on-request",
      sandbox: tasks[0]?.sandbox ?? defaults.sandbox ?? "workspace-write",
      model: tasks[0]?.model ?? defaults.model,
      personality: "pragmatic",
      serviceName: "task-yml-runner",
    });


    console.log(`\nStarted thread: ${threadId}`);

    for (const task of tasks) {

      const taskHeader = `\n========== TASK ${task.id} ==========\n`;
      console.log(taskHeader);
      console.log(task.action.trim());
      console.log("");

      const overrides: Record<string, unknown> = {};
      const cwd = task.cwd ?? defaults.cwd;

      if (cwd) overrides.cwd = cwd;

      const approvalPolicy = task.approval_policy ?? defaults.approval_policy;
      if (approvalPolicy) overrides.approvalPolicy = approvalPolicy;

      const sandbox = task.sandbox ?? defaults.sandbox;
      if (sandbox) {
        // docs 上は turn/start で sandboxPolicy を細かく渡せるが、
        // まずは簡単に thread と同じ文字列 field も許容する実装にしている
        overrides.sandbox = sandbox;
      }

      const model = task.model ?? defaults.model;
      if (model) overrides.model = model;

      await client.startTurn(task.action, overrides);
      await client.waitForTurnCompletion();

      // Codex の最後の発話が「返答待ち」っぽければ、ここで次の turn を回す
      await client.continueConversationIfNeeded();

      // 連続 task の区切りを安定させるため少し待つ
      await sleep(100);
    }

    console.log("\nAll tasks completed.");
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});