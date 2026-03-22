export type TaskSource = "action" | "pending" | "done" | "cancel";

export type TaskRecord = {
  projectId: string;
  source: TaskSource;
  id: string;
  title: string;
  url: string;
  action: string;
};

export type ProjectDocSummary = {
  name: string;
  path: string;
};

export type ProjectDocFile = ProjectDocSummary & {
  content: string;
};
