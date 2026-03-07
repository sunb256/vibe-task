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

  const orderedTasks = orderTasks(tasks);

  return (
    <PageFrame
      title={
        <Link
          to="/"
          className="rounded-sm transition hover:text-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
        >
          {project ? `Project: ${project.name}` : "Project"}
        </Link>
      }
    >
      <section className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-[0_1px_0_rgba(9,9,11,0.04),0_14px_35px_rgba(9,9,11,0.08)]">
        <div className="mb-4 flex justify-start">
          <PrimaryButton type="button" onClick={() => void handleCreate()} disabled={isCreating}>
            {isCreating ? "作成中..." : "新規タスク"}
          </PrimaryButton>
        </div>
        {error ? <Notice tone="error" message={error} /> : null}
        {isLoading ? <Notice tone="neutral" message="Loading tasks..." /> : null}
        {!error && !isLoading && orderedTasks.length === 0 ? (
          <Notice tone="neutral" message="task は見つかりませんでした。" />
        ) : null}
        {!isLoading && orderedTasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  <th className="px-3">id</th>
                  <th className="px-3">task</th>
                  <th className="pl-1 pr-3">actions</th>
                  <th className="px-3 text-center">url</th>
                </tr>
              </thead>
              <tbody>
                {orderedTasks.map((task) => (
                  <tr key={`${task.source}-${task.id}`}>
                    <td className="rounded-l-md border-y border-l border-[var(--border)] bg-[var(--panel-strong)] px-3 py-3 text-[var(--muted)]">
                      <span
                        className={`rounded-md px-3 py-1 text-xs font-semibold uppercase ${sourceBadgeTone(task.source)}`}
                      >
                        {sourceTag(task)}
                      </span>
                    </td>
                    <td className="border-y border-[var(--border)] bg-[var(--panel-strong)] px-3 py-3">
                      <div className="space-y-1">
                        {showTaskTitle(task.title) ? (
                          <p className="font-semibold text-[var(--ink)]">{task.title}</p>
                        ) : null}
                        <p className="line-clamp-6 max-w-[44rem] whitespace-pre-wrap text-zinc-700">
                          {task.action}
                        </p>
                      </div>
                    </td>
                    <td className="border-y border-[var(--border)] bg-[var(--panel-strong)] pl-1 pr-3 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/projects/${projectId}/tasks/${task.source}/${task.id}/edit`}
                          className="inline-flex w-20 items-center justify-center rounded-md border border-[var(--border)] bg-white px-3 py-2 font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50"
                        >
                          編集
                        </Link>
                        <PrimaryButton
                          type="button"
                          className="w-20 border border-rose-200 bg-white !text-rose-700 hover:border-rose-300 hover:bg-rose-50 focus-visible:outline-rose-300"
                          onClick={() => void handleDelete(task)}
                        >
                          削除
                        </PrimaryButton>
                      </div>
                    </td>
                    <td className="rounded-r-md border-y border-r border-[var(--border)] bg-[var(--panel-strong)] px-3 py-3 text-center">
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
      className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50"
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
  return `${sourceLabel(task.source)} #${task.id}`;
}

function orderTasks(tasks: TaskRecord[]) {
  const actionTasks = tasks.filter((task) => task.source === "action");
  const doneTasks = tasks.filter((task) => task.source === "done").sort(compareTaskIdDesc);
  return [...actionTasks, ...doneTasks];
}

function compareTaskIdDesc(left: TaskRecord, right: TaskRecord) {
  const leftId = Number(left.id);
  const rightId = Number(right.id);
  if (Number.isFinite(leftId) && Number.isFinite(rightId)) {
    return rightId - leftId;
  }
  return right.id.localeCompare(left.id, undefined, { numeric: true, sensitivity: "base" });
}
