import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { parseCliArgs } from "../cli/args.js";
import type { RunnerConfig } from "../shared/types.js";

const TASKS_PROJECTS_REL_PATH = "../../tasks/projects";
const REPOSITORY_PARENT_REL_PATH = "../../..";

// repository_dir の末尾フォルダ名から tasks/projects 配下の task_file を組み立てる。
export function resolveTaskFileFromRepositoryDir(
  repositoryDir: string | undefined,
  baseDir: string,
): string | undefined {
  if (!repositoryDir) return undefined;

  const resolvedDir = path.isAbsolute(repositoryDir)
    ? repositoryDir
    : path.resolve(baseDir, repositoryDir);
  const projectDir = path.basename(path.normalize(resolvedDir));
  if (!projectDir || projectDir === "." || projectDir === ".." || projectDir === path.sep) {
    return undefined;
  }

  return resolveTaskFileFromProjectName(projectDir);
}

// プロジェクト名から tasks/projects 配下の runner task_file を組み立てる。
export function resolveTaskFileFromProjectName(projectName: string): string {
  return `../../tasks/projects/${projectName}/runner.yml`;
}

// prompts 設定と CLI 引数から project選択UIが必要かを判定する。
export function shouldPromptProjectSelection(args: string[], config: RunnerConfig): boolean {
  const cli = parseCliArgs(args);
  if (cli.showHelp) return false;
  if (cli.hasTaskProjectOption) return false;
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
  projectName: string,
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

// --task 指定時に project の存在を検証し、task/repository 解決結果を返す。
export function resolveTaskProjectSelection(
  runnerRoot: string,
  taskProjectName: string,
  projectNames: string[],
): { taskFilePath: string; repositoryDir: string } {
  if (!projectNames.includes(taskProjectName)) {
    throw new Error(`Project not found for --task: ${taskProjectName}`);
  }
  return {
    taskFilePath: resolveTaskFileFromProjectName(taskProjectName),
    repositoryDir: resolveRepositoryDirFromProjectName(runnerRoot, taskProjectName),
  };
}

// 番号入力またはフォルダ名入力を選択値へ変換する。
export function parseProjectSelectionInput(
  answer: string,
  projectNames: string[],
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
export async function askProjectSelection(projectNames: string[]): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    console.log("prompts.repository_dir が未設定です。対象プロジェクトを選択してください。");
    projectNames.forEach((name, index) => {
      console.log(`  ${index + 1}. ${name}`);
    });
    while (true) {
      const answer = await rl.question(`project [1-${projectNames.length}] > `);
      const selected = parseProjectSelectionInput(answer, projectNames);
      if (selected) {
        return selected;
      }
      console.log("invalid selection");
    }
  } finally {
    rl.close();
  }
}
