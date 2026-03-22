import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as readline from "node:readline/promises";
import { spawn } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";
import { pathToFileURL } from "node:url";
import { CodexAppServerClient } from "./app/client.js";
import { loadRunnerConfig } from "./loader/config-loader.js";
import { appendRunnerHistory, isRunnerTaskFile, loadTasks } from "./loader/task-loader.js";
import { JsonlTransport } from "./transport/jsonl-transport.js";
import type { RunnerConfig, TaskDefaults } from "./shared/types.js";
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
const DEFAULT_CONFIG_PATH = "config/config.yml";
const TASKS_PROJECTS_REL_PATH = "../../tasks/projects";
const REPOSITORY_PARENT_REL_PATH = "../../..";

// 設定値から返信モードを決定し、旧設定も後方互換で解釈する。
function resolveReplyMode(config: RunnerConfig): ReplyMode {
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

// 設定ファイル引数として有効な値だけを返す。
function getConfigValue(value: string | undefined): string | undefined {
  if (!value || value.startsWith("-")) {
    return undefined;
  }
  return value;
}

// runner実行スクリプトの場所からrunnerルートを解決する。
export function resolveRunnerRoot(argvPath: string | undefined): string {
  if (!argvPath) {
    return process.cwd();
  }
  return path.resolve(path.dirname(path.resolve(argvPath)), "..");
}

// 絶対パスはそのまま使い、相対パスはrunnerルート基準で解決する。
export function resolveRunnerPath(baseDir: string, targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }
  return path.resolve(baseDir, targetPath);
}

// repository_dir の末尾フォルダ名から tasks/projects 配下の task_file を組み立てる。
function resolveTaskFileFromRepositoryDir(
  repositoryDir: string | undefined,
  baseDir: string
): string | undefined {
  if (!repositoryDir) return undefined;
  const resolvedDir = path.isAbsolute(repositoryDir)
    ? repositoryDir
    : path.resolve(baseDir, repositoryDir);
  const projectDir = path.basename(path.normalize(resolvedDir));
  if (!projectDir || projectDir === "." || projectDir === ".." || projectDir === path.sep) {
    return undefined;
  }
  return `../../tasks/projects/${projectDir}/runner.yml`;
}

// defaults.cwd が相対指定ならrunnerルート基準の絶対パスへ変換する。
export function resolveDefaultsCwd(defaults: TaskDefaults, baseDir: string): TaskDefaults {
  const cwd = defaults.cwd;
  if (!cwd || path.isAbsolute(cwd)) {
    return defaults;
  }
  return { ...defaults, cwd: path.resolve(baseDir, cwd) };
}

// CLI引数から設定ファイルパスを抽出する。
export function parseConfigPathOption(args: string[]): string {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg.startsWith("--config=")) {
      return getConfigValue(arg.split("=")[1]) ?? DEFAULT_CONFIG_PATH;
    }
    if (arg === "--config" || arg === "-c") {
      return getConfigValue(args[i + 1]) ?? DEFAULT_CONFIG_PATH;
    }
  }
  return DEFAULT_CONFIG_PATH;
}

// CLI引数と設定を統合して実行時オプションを決める。
export function parseRuntimeOptions(
  args: string[],
  config: RunnerConfig,
  runnerRoot = process.cwd()
): RuntimeOptions {
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
    if (arg.startsWith("--config=")) {
      continue;
    }
    if (arg === "--config" || arg === "-c") {
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
  const configTaskFile =
    config.prompts?.task_file ??
    resolveTaskFileFromRepositoryDir(config.prompts?.repository_dir, runnerRoot);
  return {
    taskFilePath: taskFileArg ?? configTaskFile ?? "task.yml",
    verbose: args.includes("--verbose") || config.verbose === true,
    replyMode,
    maxAutoReplyCount: maxAutoReplyCountArg ?? config.reply_wanted?.max_auto_reply_count,
  };
}

// CLI引数にtasksファイルの位置引数があるか判定する。
function hasPositionalTaskFileArg(args: string[]): boolean {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;
    if (arg.startsWith("--config=")) continue;
    if (arg === "--config" || arg === "-c") {
      i += 1;
      continue;
    }
    if (arg.startsWith("--max-auto-reply-count=")) continue;
    if (arg === "--max-auto-reply-count" || arg === "-r") {
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) continue;
    return true;
  }
  return false;
}

// repository_dir/task_file 未指定かつ位置引数なしのときだけ選択UIを出す。
export function shouldPromptProjectSelection(args: string[], config: RunnerConfig): boolean {
  if (hasPositionalTaskFileArg(args)) return false;
  if (config.prompts?.task_file) return false;
  if (config.prompts?.repository_dir) return false;
  return true;
}

// tasks/projects ディレクトリの絶対パスを返す。
export function resolveTasksProjectsDir(runnerRoot: string): string {
  return path.resolve(runnerRoot, TASKS_PROJECTS_REL_PATH);
}

// 選択されたプロジェクト名から repository_dir を解決する。
export function resolveRepositoryDirFromProjectName(
  runnerRoot: string,
  projectName: string
): string {
  return path.resolve(runnerRoot, REPOSITORY_PARENT_REL_PATH, projectName);
}

// tasks/projects 配下のプロジェクトフォルダ名を取得する。
export async function listTaskProjectNames(runnerRoot: string): Promise<string[]> {
  const projectsDir = resolveTasksProjectsDir(runnerRoot);
  const entries = await fs.readdir(projectsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

// 番号入力またはフォルダ名入力を選択値へ変換する。
export function parseProjectSelectionInput(
  answer: string,
  projectNames: string[]
): string | undefined {
  const inputText = answer.trim();
  if (!inputText) return undefined;
  const index = Number(inputText);
  if (Number.isInteger(index) && index >= 1 && index <= projectNames.length) {
    return projectNames[index - 1];
  }
  if (projectNames.includes(inputText)) {
    return inputText;
  }
  return undefined;
}

// プロジェクト候補を表示し番号で1つ選択させる。
async function askProjectSelection(projectNames: string[]): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    console.log("prompts.repository_dir が未設定です。対象プロジェクトを選択してください。");
    projectNames.forEach((name, index) => {
      console.log(`  ${index + 1}. ${name}`);
    });
    while (true) {
      const answer = await rl.question(`project [1-${projectNames.length}] > `);
      const selected = parseProjectSelectionInput(answer, projectNames);
      if (selected) return selected;
      console.log("invalid selection");
    }
  } finally {
    rl.close();
  }
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

function runnerErrorHistoryIds(
  completedTaskIds: string[],
  currentTaskId: string | null,
  fallbackTaskIds: string[]
): string[] {
  const ids = [...completedTaskIds];
  if (currentTaskId && !ids.includes(currentTaskId)) {
    ids.push(currentTaskId);
  }
  if (ids.length > 0) {
    return ids;
  }
  return fallbackTaskIds;
}

// task.ymlと設定ファイル由来のdefaultsを統合し設定側を優先する。
export function mergeTaskDefaults(
  taskDefaults: TaskDefaults,
  promptDefaults?: TaskDefaults
): TaskDefaults {
  return { ...taskDefaults, ...(promptDefaults ?? {}) };
}

// configのprompts設定をtask既定値形式へ変換する。
export function promptConfigToDefaults(
  config: RunnerConfig,
  fallbackRepositoryDir?: string
): TaskDefaults {
  return {
    cwd: config.prompts?.repository_dir ?? fallbackRepositoryDir,
    approval_policy: config.prompts?.approval_policy,
    sandbox: config.prompts?.sandbox,
  };
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
  const args = process.argv.slice(2);
  const runnerRoot = resolveRunnerRoot(process.argv[1]);
  const configPath = resolveRunnerPath(runnerRoot, parseConfigPathOption(args));
  const config = await loadRunnerConfig(configPath);
  setupRotatingLog({
    filePath: LOG_FILE_PATH,
    maxBytes: LOG_MAX_BYTES,
    maxFiles: LOG_MAX_FILES,
  });

  let runtime = parseRuntimeOptions(args, config, runnerRoot);
  let selectedRepositoryDir: string | undefined;

  if (shouldPromptProjectSelection(args, config)) {
    const projectNames = await listTaskProjectNames(runnerRoot);
    if (projectNames.length === 0) {
      throw new Error(`No project directories found under ${resolveTasksProjectsDir(runnerRoot)}`);
    }
    const selectedProject = await askProjectSelection(projectNames);
    selectedRepositoryDir = resolveRepositoryDirFromProjectName(runnerRoot, selectedProject);
    const selectedTaskFile = resolveTaskFileFromRepositoryDir(selectedRepositoryDir, runnerRoot);
    if (!selectedTaskFile) {
      throw new Error(`Failed to resolve task file from selected project: ${selectedProject}`);
    }
    runtime = { ...runtime, taskFilePath: selectedTaskFile };
  }

  const absTaskFilePath = resolveRunnerPath(runnerRoot, runtime.taskFilePath);
  const { tasks, defaults } = await loadTasks(absTaskFilePath);
  const taskIds = tasks.map((task) => String(task.id));
  const shouldWriteRunnerHistory = isRunnerTaskFile(absTaskFilePath);
  const mergedDefaults = resolveDefaultsCwd(
    mergeTaskDefaults(defaults, promptConfigToDefaults(config, selectedRepositoryDir)),
    runnerRoot
  );

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

  const completedTaskIds: string[] = [];
  let currentTaskId: string | null = null;
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
      currentTaskId = String(task.id);
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
      if (currentTaskId) {
        completedTaskIds.push(currentTaskId);
      }
      currentTaskId = null;
    }

    const completedAt = formatCompletedAt(new Date());
    if (shouldWriteRunnerHistory) {
      await appendRunnerHistory(absTaskFilePath, {
        id: taskIds,
        datetime: completedAt,
        status: "done",
      });
    }
    console.log(`\n\nAll tasks completed. [${completedAt}]`);
  } catch (error) {
    if (shouldWriteRunnerHistory) {
      try {
        await appendRunnerHistory(absTaskFilePath, {
          id: runnerErrorHistoryIds(completedTaskIds, currentTaskId, taskIds),
          datetime: formatCompletedAt(new Date()),
          status: "error",
        });
      } catch (historyError) {
        console.error("[runner history] failed to append history", historyError);
      }
    }
    throw error;
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
