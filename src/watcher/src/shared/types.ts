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

export type WatcherConfig = {
  task_file?: string;
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
  };
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
