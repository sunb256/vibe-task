import * as fs from "node:fs/promises";
import * as path from "node:path";
import YAML from "yaml";
import type {
  RunnerHistoryEntry,
  TaskDefaults,
  TaskFile,
  TaskSpec,
} from "../shared/types.js";
import { isRecord } from "../shared/types.js";

// taskファイルを読み込み、tasks配列とdefaultsを返す。
export async function loadTasks(taskFilePath: string): Promise<{
  tasks: TaskSpec[];
  defaults: TaskDefaults;
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

export function isRunnerTaskFile(taskFilePath: string): boolean {
  return path.basename(taskFilePath).toLowerCase() === "runner.yml";
}

export async function appendRunnerHistory(
  taskFilePath: string,
  entry: RunnerHistoryEntry
): Promise<void> {
  if (!isRunnerTaskFile(taskFilePath)) {
    return;
  }
  const raw = await fs.readFile(taskFilePath, "utf8");
  const parsed = YAML.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error("runner.yml must be a mapping");
  }
  const history = parsed.history;
  if (!Array.isArray(history)) {
    parsed.history = [];
  }
  (parsed.history as RunnerHistoryEntry[]).push(entry);
  await fs.writeFile(taskFilePath, YAML.stringify(parsed), "utf8");
}
