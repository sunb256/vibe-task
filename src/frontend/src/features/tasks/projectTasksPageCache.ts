import type { Project } from "../projects/types";
import type { TaskRecord } from "./types";

const taskCache = new Map<string, TaskRecord[]>();
const projectCache = new Map<string, Project | null>();

export function readCachedTasks(projectId: string) {
  return taskCache.get(projectId);
}

export function readCachedProject(projectId: string) {
  if (!projectCache.has(projectId)) {
    return undefined;
  }
  return projectCache.get(projectId) ?? null;
}

export function saveTaskCache(projectId: string, tasks: TaskRecord[]) {
  taskCache.set(projectId, tasks);
}

export function saveProjectCache(projectId: string, project: Project | null) {
  projectCache.set(projectId, project);
}

export function resetProjectTasksPageCacheForTest() {
  taskCache.clear();
  projectCache.clear();
}
