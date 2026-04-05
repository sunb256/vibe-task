import { useCallback, useEffect, useState } from "react";

import { readErrorMessage } from "../../lib/readErrorMessage";
import { fetchProjects } from "../projects/projectApi";
import type { Project } from "../projects/types";
import {
  readCachedProject,
  readCachedRunnerHistory,
  readCachedTasks,
  saveProjectCache,
  saveRunnerHistoryCache,
  saveTaskCache,
} from "./projectTasksPageCache";
import { fetchTasks } from "./taskApi";
import type { RunnerHistoryRecord, TaskRecord } from "./types";

type ProjectTab = "tasks" | "runner" | "docs";

type UseProjectTasksDataParams = {
  projectId: string;
  activeTab: ProjectTab;
  pauseAutoRefresh: boolean;
};

type UseProjectTasksDataResult = {
  project: Project | null;
  tasks: TaskRecord[];
  runnerHistory: RunnerHistoryRecord[];
  error: string;
  isLoading: boolean;
  setError: (message: string) => void;
  refreshTasksData: () => Promise<void>;
  handleImported: () => Promise<void>;
};

const AUTO_REFRESH_MS = 60_000;

export function useProjectTasksData(
  params: UseProjectTasksDataParams,
): UseProjectTasksDataResult {
  const { projectId, activeTab, pauseAutoRefresh } = params;
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [runnerHistory, setRunnerHistory] = useState<RunnerHistoryRecord[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const refreshTasksData = useCallback(async () => {
    const taskData = await readTasks(projectId);
    saveTaskCache(projectId, taskData.tasks);
    saveRunnerHistoryCache(projectId, taskData.runnerHistory);
    setTasks(taskData.tasks);
    setRunnerHistory(taskData.runnerHistory);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setError("");
      applyCache(projectId, setProject, setTasks, setRunnerHistory, setIsLoading);
      try {
        const loadedTaskData = await readTasks(projectId);
        if (cancelled) {
          return;
        }
        saveTaskCache(projectId, loadedTaskData.tasks);
        saveRunnerHistoryCache(projectId, loadedTaskData.runnerHistory);
        setTasks(loadedTaskData.tasks);
        setRunnerHistory(loadedTaskData.runnerHistory);
        setIsLoading(false);
        try {
          const loadedProject = await readProject(projectId);
          if (!cancelled) {
            saveProjectCache(projectId, loadedProject);
            setProject(loadedProject);
          }
        } catch {
          if (!cancelled) {
            setProject(null);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(readErrorMessage(loadError, "タスク一覧の取得に失敗しました。"));
          setIsLoading(false);
        }
      }
    }

    void loadPage();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || activeTab === "docs" || isLoading || pauseAutoRefresh) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshTasksData().catch((loadError) => {
        setError(readErrorMessage(loadError, "タスク一覧の取得に失敗しました。"));
      });
    }, AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeTab, isLoading, pauseAutoRefresh, projectId, refreshTasksData]);

  const handleImported = useCallback(async () => {
    setError("");
    try {
      await refreshTasksData();
    } catch (loadError) {
      setError(readErrorMessage(loadError, "タスク一覧の取得に失敗しました。"));
      return;
    }
    try {
      const loadedProject = await readProject(projectId);
      saveProjectCache(projectId, loadedProject);
      setProject(loadedProject);
    } catch {
      saveProjectCache(projectId, null);
      setProject(null);
    }
  }, [projectId, refreshTasksData]);

  return {
    project,
    tasks,
    runnerHistory,
    error,
    isLoading,
    setError,
    refreshTasksData,
    handleImported,
  };
}

async function readProject(projectId: string) {
  const projectResponse = await fetchProjects();
  const project = projectResponse.projects.find((item) => item.id === projectId) ?? null;
  return project;
}

async function readTasks(projectId: string) {
  const taskResponse = await fetchTasks(projectId);
  return {
    tasks: taskResponse.tasks,
    runnerHistory: taskResponse.runnerHistory ?? [],
  };
}

function applyCache(
  projectId: string,
  setProject: (project: Project | null) => void,
  setTasks: (tasks: TaskRecord[]) => void,
  setRunnerHistory: (history: RunnerHistoryRecord[]) => void,
  setIsLoading: (isLoading: boolean) => void,
) {
  const cachedTasks = readCachedTasks(projectId);
  if (cachedTasks) {
    setTasks(cachedTasks);
    setRunnerHistory(readCachedRunnerHistory(projectId) ?? []);
    setIsLoading(false);
  } else {
    setTasks([]);
    setRunnerHistory([]);
    setIsLoading(true);
  }

  const cachedProject = readCachedProject(projectId);
  if (cachedProject !== undefined) {
    setProject(cachedProject);
    return;
  }
  setProject(null);
}
