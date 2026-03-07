import { useEffect, useEffectEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Notice } from "../../components/Notice";
import { PageFrame } from "../../components/PageFrame";
import { PrimaryButton } from "../../components/PrimaryButton";
import { fetchProjects } from "../projects/projectApi";
import type { Project } from "../projects/types";
import { deleteTask, fetchTasks } from "./taskApi";
import type { TaskRecord } from "./types";

export function ProjectTasksPage() {
  const { projectId = "" } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadPage = useEffectEvent(async () => {
    setIsLoading(true);
    setError("");
    setProject(null);
    setTasks([]);
    try {
      const [projectResponse, taskResponse] = await Promise.all([
        fetchProjects(),
        fetchTasks(projectId),
      ]);
      setProject(projectResponse.projects.find((item) => item.id === projectId) ?? null);
      setTasks(taskResponse.tasks);
    } catch (loadError) {
      setError(readError(loadError, "タスク一覧の取得に失敗しました。"));
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    void loadPage();
  }, [projectId, loadPage]);

  async function handleDelete(task: TaskRecord) {
    const ok = window.confirm(`task ${task.id} を削除しますか？`);
    if (!ok) {
      return;
    }
    try {
      await deleteTask(projectId, task.source, task.id);
      await loadPage();
    } catch (deleteError) {
      setError(readError(deleteError, "タスクの削除に失敗しました。"));
    }
  }

  return (
    <PageFrame
      title={project ? `${project.name} Tasks` : "Project Tasks"}
      subtitle="action と done の task をまとめて表示します。source 列で所属ファイルを判別できます。"
      actions={
        <Link
          to="/"
          className="inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent)]"
        >
          Back to TOP
        </Link>
      }
    >
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[0_18px_50px_rgba(31,43,46,0.08)] backdrop-blur">
        {error ? <Notice tone="error" message={error} /> : null}
        {isLoading ? <Notice tone="neutral" message="Loading tasks..." /> : null}
        {!error && !isLoading && tasks.length === 0 ? (
          <Notice tone="neutral" message="task は見つかりませんでした。" />
        ) : null}
        {!isLoading && tasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  <th className="px-3">id</th>
                  <th className="px-3">title</th>
                  <th className="px-3">url</th>
                  <th className="px-3">source</th>
                  <th className="px-3">action</th>
                  <th className="px-3">actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={`${task.source}-${task.id}`}>
                    <td className="rounded-l-2xl border-y border-l border-[var(--border)] bg-white px-3 py-4 font-semibold">
                      {task.id}
                    </td>
                    <td className="border-y border-[var(--border)] bg-white px-3 py-4">
                      {task.title}
                    </td>
                    <td className="border-y border-[var(--border)] bg-white px-3 py-4">
                      <span className="block max-w-[14rem] break-all">
                        {task.url}
                      </span>
                    </td>
                    <td className="border-y border-[var(--border)] bg-white px-3 py-4">
                      <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase text-[var(--accent)]">
                        {task.source}
                      </span>
                    </td>
                    <td className="border-y border-[var(--border)] bg-white px-3 py-4">
                      <p className="line-clamp-3 max-w-[22rem] whitespace-pre-wrap text-[var(--muted)]">
                        {task.action}
                      </p>
                    </td>
                    <td className="rounded-r-2xl border-y border-r border-[var(--border)] bg-white px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/projects/${projectId}/tasks/${task.source}/${task.id}/edit`}
                          className="inline-flex rounded-full border border-[var(--border)] px-3 py-2 font-semibold text-[var(--accent)]"
                        >
                          EDIT
                        </Link>
                        <PrimaryButton
                          type="button"
                          className="bg-rose-600 hover:bg-rose-700 focus-visible:outline-rose-600"
                          onClick={() => void handleDelete(task)}
                        >
                          DELETE
                        </PrimaryButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </PageFrame>
  );
}

function readError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
