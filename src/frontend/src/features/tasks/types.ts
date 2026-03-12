export type TaskSource = "action" | "pending" | "done" | "cancel";

export type TaskRecord = {
  projectId: string;
  source: TaskSource;
  id: string;
  title: string;
  url: string;
  action: string;
};
