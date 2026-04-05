import { sleep } from "../shared/utils.js";
import type { TaskDefaults, TaskSpec } from "../shared/types.js";
import type { CodexAppServerClient } from "../app/client.js";

type ExecuteTaskTurnsParams = {
  client: CodexAppServerClient;
  tasks: TaskSpec[];
  mergedDefaults: TaskDefaults;
  commonPrompt?: string;
  buildTaskPrompt: (action: string, commonPrompt?: string) => string;
  formatPromptText: (text: string) => string;
  onTaskStarted?: (taskId: string) => void;
  onTaskCompleted: (taskId: string) => void;
};

export async function executeTaskTurns(params: ExecuteTaskTurnsParams): Promise<void> {
  const {
    client,
    tasks,
    mergedDefaults,
    commonPrompt,
    buildTaskPrompt,
    formatPromptText,
    onTaskStarted,
    onTaskCompleted,
  } = params;

  for (const [index, task] of tasks.entries()) {
    const taskId = String(task.id);
    onTaskStarted?.(taskId);
    const turnPrompt = buildTaskPrompt(task.action, commonPrompt);
    printTaskHeader(taskId, turnPrompt, formatPromptText, index > 0);

    const overrides = buildTurnOverrides(task, mergedDefaults);
    await client.startTurn(turnPrompt, overrides);
    await client.waitForTurnCompletion();
    await client.continueConversationIfNeeded();
    await sleep(100);

    onTaskCompleted(taskId);
  }
}

function printTaskHeader(
  taskId: string,
  turnPrompt: string,
  formatPromptText: (text: string) => string,
  withLeadingNewline: boolean,
): void {
  if (withLeadingNewline) {
    console.log("");
  }
  const taskHeader = `\n========== TASK ${taskId} ==========\n`;
  console.log(taskHeader);
  console.log(formatPromptText(turnPrompt));
  console.log("");
}

function buildTurnOverrides(task: TaskSpec, mergedDefaults: TaskDefaults): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  const cwd = task.cwd ?? mergedDefaults.cwd;
  const approvalPolicy = task.approval_policy ?? mergedDefaults.approval_policy;
  const sandbox = task.sandbox ?? mergedDefaults.sandbox;
  const model = task.model ?? mergedDefaults.model;

  if (cwd) overrides.cwd = cwd;
  if (approvalPolicy) overrides.approvalPolicy = approvalPolicy;
  if (sandbox) overrides.sandbox = sandbox;
  if (model) overrides.model = model;

  return overrides;
}
