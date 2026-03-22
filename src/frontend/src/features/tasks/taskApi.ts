import { apiFetch } from "../../lib/api";
import type {
  ProjectDocFile,
  ProjectDocSummary,
  RunnerHistoryRecord,
  RunnerLogRecord,
  TaskRecord,
  TaskSource,
} from "./types";

type TaskListResponse = {
  tasks: TaskRecord[];
  runnerHistory?: RunnerHistoryRecord[];
};

type DocListResponse = {
  docs: ProjectDocSummary[];
};

type RunnerExecuteResponse = {
  running: boolean;
};

export function fetchTasks(projectId: string) {
  return apiFetch<TaskListResponse>(`/api/projects/${projectId}/tasks`);
}

export function fetchProjectDocs(projectId: string) {
  return apiFetch<DocListResponse>(`/api/projects/${projectId}/docs`, { cache: "no-store" });
}

export function fetchProjectDoc(projectId: string, docPath: string) {
  const encodedPath = docPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return apiFetch<ProjectDocFile>(`/api/projects/${projectId}/docs/${encodedPath}`, {
    cache: "no-store",
  });
}

export function createTask(projectId: string, source: TaskSource) {
  return apiFetch<TaskRecord>(`/api/projects/${projectId}/tasks/${source}`, {
    method: "POST",
  });
}

export function fetchTask(projectId: string, source: TaskSource, taskId: string) {
  return apiFetch<TaskRecord>(`/api/projects/${projectId}/tasks/${source}/${taskId}`);
}

export function updateTask(
  projectId: string,
  source: TaskSource,
  taskId: string,
  action: string,
  nextSource?: TaskSource,
) {
  const json = nextSource ? { action, nextSource } : { action };
  return apiFetch<TaskRecord>(`/api/projects/${projectId}/tasks/${source}/${taskId}`, {
    method: "PATCH",
    json,
  });
}

export function deleteTask(projectId: string, source: TaskSource, taskId: string) {
  return apiFetch<void>(`/api/projects/${projectId}/tasks/${source}/${taskId}`, {
    method: "DELETE",
  });
}

export function swapTaskId(
  projectId: string,
  source: TaskSource,
  taskId: string,
  swapWithId: string,
) {
  return apiFetch<void>(`/api/projects/${projectId}/tasks/${source}/${taskId}/swap`, {
    method: "PATCH",
    json: { swapWithId },
  });
}

export function executeRunner(projectId: string) {
  return apiFetch<RunnerExecuteResponse>(`/api/projects/${projectId}/runner/execute`, {
    method: "POST",
  });
}

export function fetchRunnerLogs(projectId: string, lines = 200) {
  return apiFetch<RunnerLogRecord>(`/api/projects/${projectId}/runner/logs?lines=${lines}`, {
    cache: "no-store",
  });
}
