import * as path from "node:path";
import { spawn } from "node:child_process";
import { CodexAppServerClient } from "./app/client.js";
import { loadWatcherConfig } from "./config/config-loader.js";
import { JsonlTransport } from "./transport/jsonl-transport.js";
import { loadTasks } from "./task/task-loader.js";
import { sleep } from "./shared/utils.js";

async function main(): Promise<void> {
  const configPath = path.resolve("config.yml");
  const config = await loadWatcherConfig(configPath);

  const taskFilePath = process.argv[2] ?? config.task_file ?? "task.yml";
  const absTaskFilePath = path.resolve(taskFilePath);
  const { tasks, defaults } = await loadTasks(absTaskFilePath);

  const codexCommand = config.codex?.command ?? "codex";
  const codexArgs = config.codex?.args ?? ["app-server", "--listen", "stdio://"];
  const proc = spawn(codexCommand, codexArgs, {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  const transport = new JsonlTransport(proc);
  const client = new CodexAppServerClient(transport);

  try {
    await client.initialize();

    // thread は 1 run 全体で共有
    const firstTaskCwd = tasks[0]?.cwd ?? defaults.cwd ?? process.cwd();

    const threadId = await client.startThread({
      cwd: firstTaskCwd,
      approvalPolicy: tasks[0]?.approval_policy ?? defaults.approval_policy ?? "on-request",
      sandbox: tasks[0]?.sandbox ?? defaults.sandbox ?? "workspace-write",
      model: tasks[0]?.model ?? defaults.model,
      personality: config.thread?.personality ?? "pragmatic",
      serviceName: config.thread?.service_name ?? "task-yml-runner",
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
