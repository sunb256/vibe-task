import { apiFetch } from "../../lib/api";
import type { TaskRecord, TaskSource } from "./types";

type TaskListResponse = {
  tasks: TaskRecord[];
};

export function fetchTasks(projectId: string) {
  return apiFetch<TaskListResponse>(`/api/projects/${projectId}/tasks`);
}

export function createActionTask(projectId: string) {
  return apiFetch<TaskRecord>(`/api/projects/${projectId}/tasks/action`, {
    method: "POST",
  });
}

export function fetchTask(projectId: string, source: TaskSource, taskId: string) {
  return apiFetch<TaskRecord>(`/api/projects/${projectId}/tasks/${source}/${taskId}`);
}

export function updateTaskAction(
  projectId: string,
  source: TaskSource,
  taskId: string,
  action: string,
) {
  return apiFetch<TaskRecord>(`/api/projects/${projectId}/tasks/${source}/${taskId}`, {
    method: "PATCH",
    json: { action },
  });
}

export function deleteTask(projectId: string, source: TaskSource, taskId: string) {
  return apiFetch<void>(`/api/projects/${projectId}/tasks/${source}/${taskId}`, {
    method: "DELETE",
  });
}
