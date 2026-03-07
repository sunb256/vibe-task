import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Notice } from "../../components/Notice";
import { PageFrame } from "../../components/PageFrame";
import { PrimaryButton } from "../../components/PrimaryButton";
import { fetchProjects } from "../projects/projectApi";
import { NewTaskDialog } from "./NewTaskDialog";
import type { Project } from "../projects/types";
import {
  readCachedProject,
  readCachedTasks,
  saveProjectCache,
  saveTaskCache,
} from "./projectTasksPageCache";
import { createActionTask, deleteTask, fetchTasks, updateTaskAction } from "./taskApi";
import type { TaskRecord } from "./types";

const defaultTaskAction = "TODO\n";

export function ProjectTasksPage() {
  const { projectId = "" } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTask, setEditTask] = useState<TaskRecord | null>(null);
  const [newTaskAction, setNewTaskAction] = useState(defaultTaskAction);
  const [editTaskAction, setEditTaskAction] = useState("");
  const [showTodo, setShowTodo] = useState(true);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setError("");
      applyCache(projectId, setProject, setTasks, setIsLoading);
      try {
        const loadedTasks = await readTasks(projectId);
        if (cancelled) {
          return;
        }
        saveTaskCache(projectId, loadedTasks);
        setTasks(loadedTasks);
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
          setError(readError(loadError, "タスク一覧の取得に失敗しました。"));
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
      await refreshTasks(projectId, setTasks);
    } catch (deleteError) {
      setError(readError(deleteError, "タスクの削除に失敗しました。"));
    }
  }

  function openCreateDialog() {
    setCreateError("");
    setNewTaskAction(defaultTaskAction);
    setIsCreateOpen(true);
  }

  function closeCreateDialog() {
    if (isCreating) {
      return;
    }
    setCreateError("");
    setIsCreateOpen(false);
  }

  function openEditDialog(task: TaskRecord) {
    setEditError("");
    setEditTask(task);
    setEditTaskAction(task.action);
    setIsEditOpen(true);
  }

  function closeEditDialog() {
    if (isEditing) {
      return;
    }
    setEditError("");
    setIsEditOpen(false);
    setEditTask(null);
    setEditTaskAction("");
  }

  async function handleCreate() {
    setIsCreating(true);
    setCreateError("");
    try {
      const created = await createActionTask(projectId);
      await updateTaskAction(projectId, "action", created.id, newTaskAction);
      await refreshTasks(projectId, setTasks);
      setIsCreateOpen(false);
    } catch (createError) {
      setCreateError(readError(createError, "task の作成に失敗しました。"));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleEdit() {
    if (!editTask) {
      return;
    }
    setIsEditing(true);
    setEditError("");
    try {
      await updateTaskAction(projectId, editTask.source, editTask.id, editTaskAction);
      await refreshTasks(projectId, setTasks);
      setIsEditOpen(false);
      setEditTask(null);
      setEditTaskAction("");
    } catch (saveError) {
      setEditError(readError(saveError, "task の更新に失敗しました。"));
    } finally {
      setIsEditing(false);
    }
  }

  const orderedTasks = orderTasks(tasks);
  const visibleTasks = filterTasks(orderedTasks, showTodo, showDone);
  const todoCount = countTasks(tasks, "action");
  const doneCount = countTasks(tasks, "done");

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
        <div className="mb-4 flex items-center justify-start gap-2">
          <PrimaryButton type="button" onClick={openCreateDialog} disabled={isCreating}>
            新規タスク
          </PrimaryButton>
          <button
            type="button"
            aria-pressed={showTodo}
            onClick={() => setShowTodo((value) => !value)}
            className={`${sourceFilterClass("todo", showTodo)} ml-2`}
          >
            {`TODO(${todoCount})`}
          </button>
          <button
            type="button"
            aria-pressed={showDone}
            onClick={() => setShowDone((value) => !value)}
            className={sourceFilterClass("done", showDone)}
          >
            {`DONE(${doneCount})`}
          </button>
        </div>
        {error ? <Notice tone="error" message={error} /> : null}
        {isLoading ? <Notice tone="neutral" message="Loading tasks..." /> : null}
        {!error && !isLoading && visibleTasks.length === 0 ? (
          <Notice tone="neutral" message="task は見つかりませんでした。" />
        ) : null}
        {!isLoading && visibleTasks.length > 0 ? (
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
                {visibleTasks.map((task) => (
                  <tr key={`${task.source}-${task.id}`}>
                    <td className="rounded-l-md border-y border-l border-[var(--border)] bg-[var(--panel-strong)] px-3 py-3 text-[var(--muted)]">
                      <span
                        className={`rounded-md px-3 py-1 text-xs font-semibold uppercase ${sourceBadgeTone(task.source)}`}
                      >
                        {sourceTag(task)}
                      </span>
                    </td>
                    <td className="border-y border-[var(--border)] bg-[var(--panel-strong)]">
                      <button
                        type="button"
                        aria-label={`task ${task.id} を編集`}
                        onClick={() => openEditDialog(task)}
                        className="block h-full w-full px-3 py-3 text-left transition hover:bg-zinc-50/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      >
                        <div className="space-y-1">
                          {showTaskTitle(task.title) ? (
                            <p className="font-semibold text-[var(--ink)]">{task.title}</p>
                          ) : null}
                          <p className="line-clamp-6 max-w-[44rem] whitespace-pre-wrap text-zinc-700">
                            {task.action}
                          </p>
                        </div>
                      </button>
                    </td>
                    <td className="border-y border-[var(--border)] bg-[var(--panel-strong)] pl-1 pr-3 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditDialog(task)}
                          className="inline-flex w-20 items-center justify-center rounded-md border border-[var(--border)] bg-white px-3 py-2 font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50"
                        >
                          編集
                        </button>
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
      <NewTaskDialog
        isOpen={isCreateOpen}
        isSaving={isCreating}
        error={createError}
        action={newTaskAction}
        title="新規タスク"
        description=""
        submitLabel="新規作成"
        submittingLabel="作成中..."
        enableShortcut
        onActionChange={setNewTaskAction}
        onClose={closeCreateDialog}
        onSubmit={handleCreate}
      />
      <NewTaskDialog
        isOpen={isEditOpen}
        isSaving={isEditing}
        error={editError}
        action={editTaskAction}
        title={editTask ? `Edit Task ${editTask.id}` : "Edit Task"}
        description=""
        submitLabel="更新"
        submittingLabel="更新中..."
        enableShortcut
        onActionChange={setEditTaskAction}
        onClose={closeEditDialog}
        onSubmit={handleEdit}
      />
    </PageFrame>
  );
}

function readError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

async function readProject(projectId: string) {
  const projectResponse = await fetchProjects();
  const project = projectResponse.projects.find((item) => item.id === projectId) ?? null;
  return project;
}

async function readTasks(projectId: string) {
  const taskResponse = await fetchTasks(projectId);
  return taskResponse.tasks;
}

async function refreshTasks(projectId: string, setTasks: (tasks: TaskRecord[]) => void) {
  const tasks = await readTasks(projectId);
  saveTaskCache(projectId, tasks);
  setTasks(tasks);
}

function applyCache(
  projectId: string,
  setProject: (project: Project | null) => void,
  setTasks: (tasks: TaskRecord[]) => void,
  setIsLoading: (isLoading: boolean) => void,
) {
  const cachedTasks = readCachedTasks(projectId);
  if (cachedTasks) {
    setTasks(cachedTasks);
    setIsLoading(false);
  } else {
    setTasks([]);
    setIsLoading(true);
  }
  const cachedProject = readCachedProject(projectId);
  if (cachedProject !== undefined) {
    setProject(cachedProject);
  } else {
    setProject(null);
  }
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
  return "bg-blue-100 text-blue-700";
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

function sourceFilterClass(source: "todo" | "done", active: boolean) {
  const tone =
    source === "todo"
      ? "border-blue-200 bg-blue-100 text-blue-700"
      : "border-emerald-200 bg-emerald-100 text-emerald-700";
  const inactive = "border-[var(--border)] bg-white text-[var(--muted)]";
  const toneClass = active ? tone : inactive;
  return `inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold uppercase tracking-[0.08em] transition ${toneClass}`;
}

function orderTasks(tasks: TaskRecord[]) {
  const actionTasks = tasks.filter((task) => task.source === "action");
  const doneTasks = tasks.filter((task) => task.source === "done").sort(compareTaskIdDesc);
  return [...actionTasks, ...doneTasks];
}

function filterTasks(tasks: TaskRecord[], showTodo: boolean, showDone: boolean) {
  return tasks.filter((task) => {
    if (task.source === "action") {
      return showTodo;
    }
    return showDone;
  });
}

function countTasks(tasks: TaskRecord[], source: TaskRecord["source"]) {
  return tasks.filter((task) => task.source === source).length;
}

function compareTaskIdDesc(left: TaskRecord, right: TaskRecord) {
  const leftId = Number(left.id);
  const rightId = Number(right.id);
  if (Number.isFinite(leftId) && Number.isFinite(rightId)) {
    return rightId - leftId;
  }
  return right.id.localeCompare(left.id, undefined, { numeric: true, sensitivity: "base" });
}
