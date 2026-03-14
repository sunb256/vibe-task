import * as path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { CodexAppServerClient } from "./app/client.js";
import { loadWatcherConfig } from "./config/config-loader.js";
import { JsonlTransport } from "./transport/jsonl-transport.js";
import { loadTasks } from "./task/task-loader.js";
import type { TaskDefaults, WatcherConfig } from "./shared/types.js";
import { setupRotatingLog } from "./shared/rotating-log.js";
import { sleep } from "./shared/utils.js";

type ReplyMode = "harfauto" | "fullauto";

type RuntimeOptions = {
  taskFilePath: string;
  verbose: boolean;
  replyMode: ReplyMode;
  maxAutoReplyCount?: number;
};

const LOG_FILE_PATH = path.resolve("logs/log.log");
const LOG_MAX_BYTES = 10 * 1024 * 1024;
const LOG_MAX_FILES = 5;

// 設定値から返信モードを決定し、旧設定も後方互換で解釈する。
function resolveReplyMode(config: WatcherConfig): ReplyMode {
  if (config.reply_wanted?.mode) {
    return config.reply_wanted.mode;
  }
  return config.reply_wanted?.auto_reply === true ? "fullauto" : "harfauto";
}

// 0以上の整数文字列を数値へ変換する。
function parseNonNegativeInteger(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

// CLI引数と設定を統合して実行時オプションを決める。
export function parseRuntimeOptions(args: string[], config: WatcherConfig): RuntimeOptions {
  let taskFileArg: string | undefined;
  let maxAutoReplyCountArg: number | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg.startsWith("--max-auto-reply-count=")) {
      maxAutoReplyCountArg = parseNonNegativeInteger(arg.split("=")[1]) ?? maxAutoReplyCountArg;
      continue;
    }
    if (arg === "--max-auto-reply-count" || arg === "-r") {
      maxAutoReplyCountArg = parseNonNegativeInteger(args[i + 1]) ?? maxAutoReplyCountArg;
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }
    if (!taskFileArg) {
      taskFileArg = arg;
    }
  }

  const hasHarfAuto = args.includes("-h") || args.includes("--harfauto") || args.includes("--halfauto");
  const hasFullAuto = args.includes("-f") || args.includes("--fullauto");
  const replyMode = hasHarfAuto ? "harfauto" : hasFullAuto ? "fullauto" : resolveReplyMode(config);
  return {
    taskFilePath: taskFileArg ?? config.prompts?.task_file ?? "task.yml",
    verbose: args.includes("--verbose") || config.verbose === true,
    replyMode,
    maxAutoReplyCount: maxAutoReplyCountArg ?? config.reply_wanted?.max_auto_reply_count,
  };
}

// 完了日時を yyyy-mm-dd HH:mm:ss 形式の文字列へ整形する。
export function formatCompletedAt(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const sec = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
}

// 入力文表示を各行 `> ` プレフィックス付きへ整形する。
export function formatPromptText(text: string): string {
  return text
    .trim()
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

// configの共通指示文とtask本文を結合してturn入力を組み立てる。
export function buildTaskPrompt(action: string, commonPrompt?: string): string {
  const common = commonPrompt?.trim();
  if (!common) {
    return action;
  }
  if (!action.trim()) {
    return common;
  }
  return `${common}\n\n${action}`;
}

// task.ymlとconfig.yml由来のdefaultsを統合しconfig側を優先する。
export function mergeTaskDefaults(
  taskDefaults: TaskDefaults,
  promptDefaults?: TaskDefaults
): TaskDefaults {
  return { ...taskDefaults, ...(promptDefaults ?? {}) };
}

// 現在モジュールがCLIエントリポイントとして実行されたかを判定する。
function isEntryPoint(): boolean {
  const argvPath = process.argv[1];
  if (!argvPath) return false;
  const fileUrl = pathToFileURL(path.resolve(argvPath)).href;
  return import.meta.url === fileUrl;
}

// タスクファイルを順に処理してCodexとの対話実行を進める。
async function main(): Promise<void> {
  const configPath = path.resolve("config.yml");
  const config = await loadWatcherConfig(configPath);
  setupRotatingLog({
    filePath: LOG_FILE_PATH,
    maxBytes: LOG_MAX_BYTES,
    maxFiles: LOG_MAX_FILES,
  });

  const runtime = parseRuntimeOptions(process.argv.slice(2), config);
  const taskFilePath = runtime.taskFilePath;
  const absTaskFilePath = path.resolve(taskFilePath);
  const { tasks, defaults } = await loadTasks(absTaskFilePath);
  const mergedDefaults = mergeTaskDefaults(defaults, config.prompts?.defaults);

  const codexCommand = config.codex?.command ?? "codex";
  const codexArgs = config.codex?.args ?? ["app-server", "--listen", "stdio://"];
  const proc = spawn(codexCommand, codexArgs, {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  const transport = new JsonlTransport(proc);
  const client = new CodexAppServerClient(transport, {
    verbose: runtime.verbose,
    replyWanted: config.reply_wanted,
    replyMode: runtime.replyMode,
    maxAutoReplyCount: runtime.maxAutoReplyCount,
  });

  try {
    await client.initialize();

    // thread は 1 run 全体で共有
    const firstTaskCwd = tasks[0]?.cwd ?? mergedDefaults.cwd ?? process.cwd();

    const threadId = await client.startThread({
      cwd: firstTaskCwd,
      approvalPolicy: tasks[0]?.approval_policy ?? mergedDefaults.approval_policy ?? "on-request",
      sandbox: tasks[0]?.sandbox ?? mergedDefaults.sandbox ?? "workspace-write",
      model: tasks[0]?.model ?? mergedDefaults.model,
      personality: config.thread?.personality ?? "pragmatic",
      serviceName: config.thread?.service_name ?? "task-yml-runner",
    });

    // console.log(`\nStarted thread: ${threadId}`);

    for (const [index, task] of tasks.entries()) {
      if (index > 0) {
        console.log("");
      }
      const taskHeader = `\n========== TASK ${task.id} ==========\n`;
      const turnPrompt = buildTaskPrompt(task.action, config.prompts?.common);
      console.log(taskHeader);
      console.log(formatPromptText(turnPrompt));
      console.log("");

      const overrides: Record<string, unknown> = {};
      const cwd = task.cwd ?? mergedDefaults.cwd;

      if (cwd) overrides.cwd = cwd;

      const approvalPolicy = task.approval_policy ?? mergedDefaults.approval_policy;
      if (approvalPolicy) overrides.approvalPolicy = approvalPolicy;

      const sandbox = task.sandbox ?? mergedDefaults.sandbox;
      if (sandbox) {
        // docs 上は turn/start で sandboxPolicy を細かく渡せるが、
        // まずは簡単に thread と同じ文字列 field も許容する実装にしている
        overrides.sandbox = sandbox;
      }

      const model = task.model ?? mergedDefaults.model;
      if (model) overrides.model = model;

      await client.startTurn(turnPrompt, overrides);
      await client.waitForTurnCompletion();

      // Codex の最後の発話が「返答待ち」っぽければ、ここで次の turn を回す
      await client.continueConversationIfNeeded();

      // 連続 task の区切りを安定させるため少し待つ
      await sleep(100);
    }

    const completedAt = formatCompletedAt(new Date());
    console.log(`\n\nAll tasks completed. [${completedAt}]`);
  } finally {
    client.close();
  }
}

if (isEntryPoint()) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
