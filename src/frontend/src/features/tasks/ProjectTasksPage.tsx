import { useEffect, useState } from "react";
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

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setIsLoading(true);
      setError("");
      setProject(null);
      setTasks([]);
      try {
        const data = await readProjectPage(projectId);
        if (!cancelled) {
          setProject(data.project);
          setTasks(data.tasks);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(readError(loadError, "タスク一覧の取得に失敗しました。"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPage();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleDelete(task: TaskRecord) {
    const ok = window.confirm(`task ${task.id} を削除しますか？`);
    if (!ok) {
      return;
    }
    try {
      await deleteTask(projectId, task.source, task.id);
      const data = await readProjectPage(projectId);
      setProject(data.project);
      setTasks(data.tasks);
    } catch (deleteError) {
      setError(readError(deleteError, "タスクの削除に失敗しました。"));
    }
  }

  return (
    <PageFrame
      title={
        <Link
          to="/"
          className="rounded-sm transition hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
        >
          {project ? `${project.name} Tasks` : "Project Tasks"}
        </Link>
      }
    >
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[0_18px_50px_rgba(31,43,46,0.08)] backdrop-blur">
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
                    <td className="rounded-l-xl border-y border-l border-[var(--border)] bg-white px-3 py-4 font-semibold">
                      {task.id}
                    </td>
                    <td className="border-y border-[var(--border)] bg-white px-3 py-4">
                      {task.title}
                    </td>
                    <td className="border-y border-[var(--border)] bg-white px-3 py-4">
                      <TaskPrLink url={task.url} />
                    </td>
                    <td className="border-y border-[var(--border)] bg-white px-3 py-4">
                      <span className="rounded-lg bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase text-[var(--accent)]">
                        {task.source}
                      </span>
                    </td>
                    <td className="border-y border-[var(--border)] bg-white px-3 py-4">
                      <p className="line-clamp-3 max-w-[22rem] whitespace-pre-wrap text-[var(--muted)]">
                        {task.action}
                      </p>
                    </td>
                    <td className="rounded-r-xl border-y border-r border-[var(--border)] bg-white px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/projects/${projectId}/tasks/${task.source}/${task.id}/edit`}
                          className="inline-flex rounded-xl border border-[var(--border)] px-3 py-2 font-semibold text-[var(--accent)]"
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

async function readProjectPage(projectId: string) {
  const [projectResponse, taskResponse] = await Promise.all([
    fetchProjects(),
    fetchTasks(projectId),
  ]);
  const project = projectResponse.projects.find((item) => item.id === projectId) ?? null;
  return { project, tasks: taskResponse.tasks };
}

type TaskPrLinkProps = {
  url: string;
};

function TaskPrLink(props: TaskPrLinkProps) {
  if (props.url === "-") {
    return <span className="block max-w-[14rem] break-all">-</span>;
  }

  return (
    <a
      href={props.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/8"
    >
      {prLabel(props.url)}
    </a>
  );
}

function prLabel(url: string) {
  const matched = /\/pull\/(\d+)$/.exec(url);
  if (!matched) {
    return "PR";
  }
  return `PR #${matched[1]}`;
}
