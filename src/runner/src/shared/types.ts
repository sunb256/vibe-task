export type JsonRpcId = number | string;

export type JsonRpcRequest = {
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type JsonRpcNotification = {
  method: string;
  params?: unknown;
};

export type TaskSpec = {
  id: string | number;
  action: string;
  cwd?: string;
  approval_policy?: string;
  sandbox?: string;
  model?: string;
};

export type TaskDefaults = {
  cwd?: string;
  approval_policy?: string;
  sandbox?: string;
  model?: string;
};

export type TaskFile = {
  task?: TaskSpec[];
  tasks?: TaskSpec[];
  defaults?: TaskDefaults;
};

export type RunnerConfig = {
  verbose?: boolean;
  codex?: {
    command?: string;
    args?: string[];
  };
  thread?: {
    personality?: string;
    service_name?: string;
  };
  reply_wanted?: {
    suffixes?: string[];
    patterns?: string[];
    mode?: "harfauto" | "fullauto";
    auto_reply?: boolean;
    max_auto_reply_count?: number;
  };
  prompts?: {
    task_file?: string;
    common?: string;
    repository_dir?: string;
    approval_policy?: string;
    sandbox?: string;
  };
};

// unknown値がRecordかどうかを判定する。
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
