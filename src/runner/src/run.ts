import * as path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import { CodexAppServerClient } from "./app/client.js";
import {
  buildUsageText,
  isUsageError,
  parseCliArgs,
  parseConfigPathOption,
} from "./cli/args.js";
import { loadRunnerConfig } from "./loader/config-loader.js";
import { appendRunnerHistory, isRunnerTaskFile, loadTasks } from "./loader/task-loader.js";
import { executeTaskTurns } from "./runtime/executor.js";
import { buildDoneHistory, buildErrorHistory } from "./runtime/history.js";
import {
  askProjectSelection,
  listTaskProjectNames,
  parseProjectSelectionInput,
  resolveRepositoryDirFromProjectName,
  resolveTaskFileFromProjectName,
  resolveTaskFileFromRepositoryDir,
  resolveTaskProjectSelection,
  resolveTasksProjectsDir,
  shouldPromptProjectSelection,
} from "./runtime/selection.js";
import type { RunnerConfig, TaskDefaults } from "./shared/types.js";
import { setupRotatingLog } from "./shared/rotating-log.js";
import { JsonlTransport } from "./transport/jsonl-transport.js";

export {
  parseConfigPathOption,
  parseProjectSelectionInput,
  resolveRepositoryDirFromProjectName,
  resolveTaskProjectSelection,
  resolveTasksProjectsDir,
  shouldPromptProjectSelection,
};

type ReplyMode = "harfauto" | "fullauto";

type RuntimeOptions = {
  taskFilePath: string;
  verbose: boolean;
  replyMode: ReplyMode;
  maxAutoReplyCount?: number;
  taskProjectName?: string;
  hasTaskProjectOption: boolean;
  showHelp: boolean;
};

const LOG_FILE_PATH = path.resolve("logs/log.log");
const LOG_MAX_BYTES = 10 * 1024 * 1024;
const LOG_MAX_FILES = 5;
const TASK_OPTION_NAME = "--task";
const REPOSITORY_DIR_ENV_NAME = "RUNNER_REPOSITORY_DIR";

// 設定値から返信モードを決定し、旧設定も後方互換で解釈する。
function resolveReplyMode(config: RunnerConfig): ReplyMode {
  if (config.reply_wanted?.mode) {
    return config.reply_wanted.mode;
  }
  return config.reply_wanted?.auto_reply === true ? "fullauto" : "harfauto";
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

// defaults.cwd が相対指定ならrunnerルート基準の絶対パスへ変換する。
export function resolveDefaultsCwd(defaults: TaskDefaults, baseDir: string): TaskDefaults {
  const cwd = defaults.cwd;
  if (!cwd || path.isAbsolute(cwd)) {
    return defaults;
  }
  return { ...defaults, cwd: path.resolve(baseDir, cwd) };
}

// CLI引数と設定を統合して実行時オプションを決める。
export function parseRuntimeOptions(
  args: string[],
  config: RunnerConfig,
  runnerRoot = process.cwd(),
): RuntimeOptions {
  const cli = parseCliArgs(args);
  const replyMode = resolveReplyMode(config);
  const configTaskFile =
    config.prompts?.task_file ??
    resolveTaskFileFromRepositoryDir(config.prompts?.repository_dir, runnerRoot);

  return {
    taskFilePath:
      (cli.taskProjectName ? resolveTaskFileFromProjectName(cli.taskProjectName) : undefined) ??
      configTaskFile ??
      "task.yml",
    verbose: cli.verbose || config.verbose === true,
    replyMode,
    maxAutoReplyCount: config.reply_wanted?.max_auto_reply_count,
    taskProjectName: cli.taskProjectName,
    hasTaskProjectOption: cli.hasTaskProjectOption,
    showHelp: cli.showHelp,
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

// task.ymlと設定ファイル由来のdefaultsを統合し設定側を優先する。
export function mergeTaskDefaults(
  taskDefaults: TaskDefaults,
  promptDefaults?: TaskDefaults,
): TaskDefaults {
  return { ...taskDefaults, ...(promptDefaults ?? {}) };
}

// configのprompts設定をtask既定値形式へ変換する。
export function promptConfigToDefaults(
  config: RunnerConfig,
  fallbackRepositoryDir?: string,
): TaskDefaults {
  return {
    cwd: config.prompts?.repository_dir ?? fallbackRepositoryDir,
    approval_policy: config.prompts?.approval_policy,
    sandbox: config.prompts?.sandbox,
  };
}

function expandEnvVariables(value: string, env: NodeJS.ProcessEnv): string {
  return value.replace(/\$([A-Za-z_][A-Za-z0-9_]*)|\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name, bracedName) => {
    const key = String(name ?? bracedName ?? "");
    return env[key] ?? "";
  });
}

// 環境変数から repository_dir を取得し、必要に応じて展開・絶対化する。
export function resolveRepositoryDirFromEnv(
  runnerRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const raw = env[REPOSITORY_DIR_ENV_NAME]?.trim();
  if (!raw) {
    return undefined;
  }

  let expanded = expandEnvVariables(raw, env);
  if (expanded === "~" && env.HOME) {
    expanded = env.HOME;
  } else if (expanded.startsWith("~/") && env.HOME) {
    expanded = path.join(env.HOME, expanded.slice(2));
  }

  if (path.isAbsolute(expanded)) {
    return expanded;
  }
  return path.resolve(runnerRoot, expanded);
}

type RuntimeSelectionResult = {
  runtime: RuntimeOptions;
  selectedRepositoryDir?: string;
};

async function resolveRuntimeSelection(
  args: string[],
  config: RunnerConfig,
  runnerRoot: string,
  runtime: RuntimeOptions,
): Promise<RuntimeSelectionResult> {
  let nextRuntime = runtime;
  let selectedRepositoryDir: string | undefined;

  if (nextRuntime.hasTaskProjectOption) {
    if (!nextRuntime.taskProjectName) {
      throw new Error(`${TASK_OPTION_NAME} option requires a project name`);
    }
    const projectNames = await listTaskProjectNames(runnerRoot);
    const selected = resolveTaskProjectSelection(runnerRoot, nextRuntime.taskProjectName, projectNames);
    selectedRepositoryDir = selected.repositoryDir;
    nextRuntime = { ...nextRuntime, taskFilePath: selected.taskFilePath };
  }

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
    nextRuntime = { ...nextRuntime, taskFilePath: selectedTaskFile };
  }

  return {
    runtime: nextRuntime,
    selectedRepositoryDir,
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
  const cli = parseCliArgs(args);
  if (cli.showHelp) {
    console.log(buildUsageText());
    return;
  }

  const configPath = resolveRunnerPath(runnerRoot, parseConfigPathOption(args));
  const config = await loadRunnerConfig(configPath);

  setupRotatingLog({
    filePath: LOG_FILE_PATH,
    maxBytes: LOG_MAX_BYTES,
    maxFiles: LOG_MAX_FILES,
  });

  let runtime = parseRuntimeOptions(args, config, runnerRoot);
  if (runtime.showHelp) {
    console.log(buildUsageText());
    return;
  }

  const selection = await resolveRuntimeSelection(args, config, runnerRoot, runtime);
  runtime = selection.runtime;
  const repositoryDirFromEnv = resolveRepositoryDirFromEnv(runnerRoot);
  const selectedRepositoryDir = repositoryDirFromEnv ?? selection.selectedRepositoryDir;

  const absTaskFilePath = resolveRunnerPath(runnerRoot, runtime.taskFilePath);
  const { tasks, defaults } = await loadTasks(absTaskFilePath);
  const taskIds = tasks.map((task) => String(task.id));
  const shouldWriteRunnerHistory = isRunnerTaskFile(absTaskFilePath);
  const promptDefaults = selectedRepositoryDir
    ? { ...promptConfigToDefaults(config), cwd: selectedRepositoryDir }
    : promptConfigToDefaults(config, selectedRepositoryDir);
  const mergedDefaults = resolveDefaultsCwd(mergeTaskDefaults(defaults, promptDefaults), runnerRoot);

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

    const firstTaskCwd = tasks[0]?.cwd ?? mergedDefaults.cwd ?? process.cwd();
    await client.startThread({
      cwd: firstTaskCwd,
      approvalPolicy: tasks[0]?.approval_policy ?? mergedDefaults.approval_policy ?? "on-request",
      sandbox: tasks[0]?.sandbox ?? mergedDefaults.sandbox ?? "workspace-write",
      model: tasks[0]?.model ?? mergedDefaults.model,
      personality: config.thread?.personality ?? "pragmatic",
      serviceName: config.thread?.service_name ?? "task-yml-runner",
    });

    await executeTaskTurns({
      client,
      tasks,
      mergedDefaults,
      commonPrompt: config.prompts?.common,
      buildTaskPrompt,
      formatPromptText,
      onTaskStarted: (taskId) => {
        currentTaskId = taskId;
      },
      onTaskCompleted: (taskId) => {
        completedTaskIds.push(taskId);
        currentTaskId = null;
      },
    });

    const completedAt = formatCompletedAt(new Date());
    if (shouldWriteRunnerHistory) {
      await appendRunnerHistory(absTaskFilePath, buildDoneHistory(taskIds, completedAt));
    }
    console.log(`\n\nAll tasks completed. [${completedAt}]`);
  } catch (error) {
    if (shouldWriteRunnerHistory) {
      try {
        await appendRunnerHistory(
          absTaskFilePath,
          buildErrorHistory(completedTaskIds, currentTaskId, taskIds, formatCompletedAt(new Date())),
        );
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
    if (isUsageError(err)) {
      console.error(err instanceof Error ? err.message : err);
      console.log(`\n${buildUsageText()}`);
      process.exit(1);
      return;
    }
    console.error(err);
    process.exit(1);
  });
}
