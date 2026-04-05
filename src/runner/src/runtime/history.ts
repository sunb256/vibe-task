import type { RunnerHistoryEntry } from "../shared/types.js";

export function buildDoneHistory(
  taskIds: string[],
  completedAt: string,
): RunnerHistoryEntry {
  return {
    id: taskIds,
    datetime: completedAt,
    status: "done",
  };
}

export function buildErrorHistory(
  completedTaskIds: string[],
  currentTaskId: string | null,
  fallbackTaskIds: string[],
  completedAt: string,
): RunnerHistoryEntry {
  return {
    id: runnerErrorHistoryIds(completedTaskIds, currentTaskId, fallbackTaskIds),
    datetime: completedAt,
    status: "error",
  };
}

export function runnerErrorHistoryIds(
  completedTaskIds: string[],
  currentTaskId: string | null,
  fallbackTaskIds: string[],
): string[] {
  const ids = [...completedTaskIds];
  if (currentTaskId && !ids.includes(currentTaskId)) {
    ids.push(currentTaskId);
  }
  if (ids.length > 0) {
    return ids;
  }
  return fallbackTaskIds;
}
