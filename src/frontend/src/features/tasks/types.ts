export type TaskSource = "action" | "runner" | "pending" | "done" | "cancel";

export type TaskRecord = {
  projectId: string;
  source: TaskSource;
  id: string;
  title: string;
  url: string;
  action: string;
};

export type RunnerHistoryRecord = {
  id: string[];
  datetime: string;
  status: "done" | "error";
};

export type RunnerLogRecord = {
  running: boolean;
  log: string;
};

export type ProjectDocSummary = {
  name: string;
  path: string;
};

export type ProjectDocFile = ProjectDocSummary & {
  content: string;
};
