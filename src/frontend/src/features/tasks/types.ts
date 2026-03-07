export type TaskSource = "action" | "done";

export type TaskRecord = {
  projectId: string;
  source: TaskSource;
  id: string;
  title: string;
  url: string;
  action: string;
};
