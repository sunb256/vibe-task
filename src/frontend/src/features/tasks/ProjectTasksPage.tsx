import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Notice } from "../../components/Notice";
import { PageFrame } from "../../components/PageFrame";
import { PrimaryButton } from "../../components/PrimaryButton";
import { fetchProjects } from "../projects/projectApi";
import type { Project } from "../projects/types";
import { createActionTask, deleteTask, fetchTasks } from "./taskApi";
import type { TaskRecord } from "./types";

export function ProjectTasksPage() {
  const { projectId = "" } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

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

  async function handleCreate() {
    setIsCreating(true);
    setError("");
    try {
      await createActionTask(projectId);
      const data = await readProjectPage(projectId);
      setProject(data.project);
      setTasks(data.tasks);
    } catch (createError) {
      setError(readError(createError, "task の作成に失敗しました。"));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <PageFrame
      title={
        <Link
          to="/"
          className="rounded-sm transition hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
        >
          {project ? project.name : "Project"}
        </Link>
      }
    >
      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[0_18px_50px_rgba(31,43,46,0.08)] backdrop-blur">
        <div className="mb-4 flex justify-end">
          <PrimaryButton type="button" onClick={() => void handleCreate()} disabled={isCreating}>
            {isCreating ? "作成中..." : "新規"}
          </PrimaryButton>
        </div>
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
                  <th className="px-3">id/source</th>
                  <th className="px-3">task</th>
                  <th className="px-3">actions</th>
                  <th className="px-3">url</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={`${task.source}-${task.id}`}>
                    <td className="rounded-l-md border-y border-l border-[var(--border)] bg-white px-3 py-4 text-[var(--muted)]">
                      <span
                        className={`rounded-md px-3 py-1 text-xs font-semibold uppercase ${sourceBadgeTone(task.source)}`}
                      >
                        {sourceTag(task)}
                      </span>
                    </td>
                    <td className="border-y border-[var(--border)] bg-white px-3 py-4">
                      <div className="space-y-1">
                        {showTaskTitle(task.title) ? (
                          <p className="font-semibold text-[var(--ink)]">{task.title}</p>
                        ) : null}
                        <p className="line-clamp-3 max-w-[22rem] whitespace-pre-wrap text-[var(--muted)]">
                          {task.action}
                        </p>
                      </div>
                    </td>
                    <td className="border-y border-[var(--border)] bg-white px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/projects/${projectId}/tasks/${task.source}/${task.id}/edit`}
                          className="inline-flex w-20 items-center justify-center rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/18"
                        >
                          編集
                        </Link>
                        <PrimaryButton
                          type="button"
                          className="w-20 bg-rose-200 text-rose-700 hover:bg-rose-300 focus-visible:outline-rose-300"
                          onClick={() => void handleDelete(task)}
                        >
                          削除
                        </PrimaryButton>
                      </div>
                    </td>
                    <td className="rounded-r-md border-y border-r border-[var(--border)] bg-white px-3 py-4">
                      <TaskPrLink url={task.url} />
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
      className="inline-flex items-center justify-center rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/18"
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
  return `PR#${matched[1]}`;
}

function showTaskTitle(title: string) {
  return title.trim() !== "" && title.trim() !== "-";
}

function sourceBadgeTone(source: TaskRecord["source"]) {
  if (source === "done") {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-amber-100 text-amber-700";
}

function sourceLabel(source: TaskRecord["source"]) {
  if (source === "done") {
    return "DONE";
  }
  return "TODO";
}

function sourceTag(task: TaskRecord) {
  return `${sourceLabel(task.source)}(${task.id})`;
}
