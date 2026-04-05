import { useCallback, useEffect, useRef, useState } from "react";

import { readErrorMessage } from "../../lib/readErrorMessage";
import { fetchRunnerLogs } from "./taskApi";

type ProjectTab = "tasks" | "runner" | "docs";
type RunnerTab = "list" | "log" | "history";

type UseRunnerPollingParams = {
  projectId: string;
  activeTab: ProjectTab;
  activeRunnerTab: RunnerTab;
  onRunnerStopped: () => Promise<void>;
};

type RunnerLogState = {
  running: boolean;
  log: string;
};

type UseRunnerPollingResult = {
  runnerLog: string;
  runnerLogError: string;
  isRunnerRunning: boolean;
  setRunnerLogError: (message: string) => void;
  setIsRunnerRunning: (running: boolean) => void;
  refreshRunnerLog: () => Promise<RunnerLogState>;
};

const RUNNER_LOG_REFRESH_MS = 2_000;
const RUNNER_LOG_LINES = 300;

export function useRunnerPolling(
  params: UseRunnerPollingParams,
): UseRunnerPollingResult {
  const { projectId, activeTab, activeRunnerTab, onRunnerStopped } = params;
  const [runnerLog, setRunnerLog] = useState("");
  const [runnerLogError, setRunnerLogError] = useState("");
  const [isRunnerRunning, setIsRunnerRunning] = useState(false);
  const runnerRunningRef = useRef(false);

  useEffect(() => {
    runnerRunningRef.current = isRunnerRunning;
  }, [isRunnerRunning]);

  const refreshRunnerLog = useCallback(async () => {
    const next = await fetchRunnerLogs(projectId, RUNNER_LOG_LINES);
    setRunnerLog(next.log);
    setIsRunnerRunning(next.running);
    runnerRunningRef.current = next.running;
    setRunnerLogError("");
    return next;
  }, [projectId]);

  useEffect(() => {
    if (!projectId || activeTab !== "runner" || activeRunnerTab !== "log") {
      return;
    }

    let cancelled = false;

    async function pollRunnerLog() {
      try {
        const wasRunning = runnerRunningRef.current;
        const logState = await fetchRunnerLogs(projectId, RUNNER_LOG_LINES);
        if (cancelled) {
          return;
        }
        setRunnerLog(logState.log);
        setIsRunnerRunning(logState.running);
        runnerRunningRef.current = logState.running;
        setRunnerLogError("");
        if (wasRunning && !logState.running) {
          await onRunnerStopped();
        }
      } catch (runnerError) {
        if (!cancelled) {
          setRunnerLogError(readErrorMessage(runnerError, "runner ログの取得に失敗しました。"));
        }
      }
    }

    void pollRunnerLog();
    const intervalId = window.setInterval(() => {
      void pollRunnerLog();
    }, RUNNER_LOG_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeRunnerTab, activeTab, onRunnerStopped, projectId]);

  return {
    runnerLog,
    runnerLogError,
    isRunnerRunning,
    setRunnerLogError,
    setIsRunnerRunning,
    refreshRunnerLog,
  };
}
