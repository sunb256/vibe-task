import * as fs from "node:fs/promises";
import YAML from "yaml";
import type { TaskDefaults, TaskFile, TaskSpec } from "../shared/types.js";

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
