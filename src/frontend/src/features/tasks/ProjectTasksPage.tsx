import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { Notice } from "../../components/Notice";
import { PageFrame } from "../../components/PageFrame";
import { PrimaryButton } from "../../components/PrimaryButton";
import { readErrorMessage } from "../../lib/readErrorMessage";
import { fetchProjects } from "../projects/projectApi";
import { NewTaskDialog } from "./NewTaskDialog";
import { ProjectDocsPanel } from "./ProjectDocsPanel";
import type { Project } from "../projects/types";
import {
  readCachedProject,
  readCachedRunnerHistory,
  readCachedTasks,
  saveProjectCache,
  saveRunnerHistoryCache,
  saveTaskCache,
} from "./projectTasksPageCache";
import {
  createTask,
  deleteTask,
  fetchTasks,
  swapTaskId,
  updateTask,
} from "./taskApi";
import type { RunnerHistoryRecord, TaskRecord, TaskSource } from "./types";

const defaultTaskAction = "";
const AUTO_REFRESH_MS = 60_000;
type ProjectTab = "tasks" | "docs";
const defaultVisibleSources: Record<TaskSource, boolean> = {
  action: true,
  runner: true,
  pending: true,
  done: false,
  cancel: false,
};

export function ProjectTasksPage() {
  const { projectId = "" } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [runnerHistory, setRunnerHistory] = useState<RunnerHistoryRecord[]>([]);
  const [activeTab, setActiveTab] = useState<ProjectTab>("tasks");
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [editTask, setEditTask] = useState<TaskRecord | null>(null);
  const [newTaskAction, setNewTaskAction] = useState(defaultTaskAction);
  const [createTaskSource, setCreateTaskSource] = useState<TaskSource>("action");
  const [editTaskAction, setEditTaskAction] = useState("");
  const [editTaskSource, setEditTaskSource] = useState<TaskSource>("action");
  const [visibleSources, setVisibleSources] = useState(defaultVisibleSources);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setActiveTab("tasks");
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
    if (
      !projectId ||
      activeTab !== "tasks" ||
      isLoading ||
      isCreateOpen ||
      isEditOpen ||
      isCreating ||
      isEditing
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshTasks(projectId, setTasks, setRunnerHistory).catch((loadError) => {
        setError(readErrorMessage(loadError, "タスク一覧の取得に失敗しました。"));
      });
    }, AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeTab, projectId, isCreateOpen, isEditOpen, isCreating, isEditing, isLoading]);

  async function handleDelete(task: TaskRecord) {
    const ok = window.confirm(`task ${task.id} を削除しますか？`);
    if (!ok) {
      return;
    }
    try {
      await deleteTask(projectId, task.source, task.id);
      await refreshTasks(projectId, setTasks, setRunnerHistory);
    } catch (deleteError) {
      setError(readErrorMessage(deleteError, "タスクの削除に失敗しました。"));
    }
  }

  async function handleSwap(task: TaskRecord, swapWithId: string | null) {
    if (!swapWithId) {
      return;
    }
    setIsSwapping(true);
    setError("");
    try {
      await swapTaskId(projectId, task.source, task.id, swapWithId);
      await refreshTasks(projectId, setTasks, setRunnerHistory);
    } catch (swapError) {
      setError(readErrorMessage(swapError, "task の並び替えに失敗しました。"));
    } finally {
      setIsSwapping(false);
    }
  }

  function openCreateDialog() {
    setCreateError("");
    setNewTaskAction(defaultTaskAction);
    setCreateTaskSource("action");
    setIsCreateOpen(true);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || !isCreateShortcut(event)) {
        return;
      }
      if (activeTab !== "tasks") {
        return;
      }
      if (isCreateOpen || isEditOpen || isCreating || isEditing) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      setCreateError("");
      setNewTaskAction(defaultTaskAction);
      setCreateTaskSource("action");
      setIsCreateOpen(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTab, isCreateOpen, isEditOpen, isCreating, isEditing]);

  function closeCreateDialog() {
    if (isCreating) {
      return;
    }
    setCreateError("");
    setIsCreateOpen(false);
    setCreateTaskSource("action");
    createButtonRef.current?.focus();
  }

  function openEditDialog(task: TaskRecord) {
    setEditError("");
    setEditTask(task);
    setEditTaskAction(task.action);
    setEditTaskSource(task.source);
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
    setEditTaskSource("action");
    createButtonRef.current?.focus();
  }

  function handleEditTaskSource(status: string) {
    if (isTaskSource(status)) {
      setEditTaskSource(status);
    }
  }

  function handleCreateTaskSource(status: string) {
    if (isTaskSource(status)) {
      setCreateTaskSource(status);
    }
  }

  async function handleCreate() {
    setIsCreating(true);
    setCreateError("");
    try {
      const created = await createTask(projectId, createTaskSource);
      await updateTask(projectId, created.source, created.id, newTaskAction);
      await refreshTasks(projectId, setTasks, setRunnerHistory);
      setIsCreateOpen(false);
      setCreateTaskSource("action");
      createButtonRef.current?.focus();
    } catch (createError) {
      setCreateError(readErrorMessage(createError, "task の作成に失敗しました。"));
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
      const nextSource = editTaskSource === editTask.source ? undefined : editTaskSource;
      await updateTask(projectId, editTask.source, editTask.id, editTaskAction, nextSource);
      await refreshTasks(projectId, setTasks, setRunnerHistory);
      setIsEditOpen(false);
      setEditTask(null);
      setEditTaskAction("");
      setEditTaskSource("action");
      createButtonRef.current?.focus();
    } catch (saveError) {
      setEditError(readErrorMessage(saveError, "task の更新に失敗しました。"));
    } finally {
      setIsEditing(false);
    }
  }

  async function handleImported() {
    setError("");
    try {
      await refreshTasks(projectId, setTasks, setRunnerHistory);
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
  }

  const orderedTasks = orderTasks(tasks);
  const visibleTasks = filterTasks(orderedTasks, visibleSources);

  return (
    <PageFrame
      eyebrow={null}
      title={<ProjectTabs repositoryName={project?.name ?? "Project"} activeTab={activeTab} onChange={setActiveTab} />}
      actions={
        project?.repositoryPath ? (
          <ProjectHeaderActions repositoryPath={project.repositoryPath} />
        ) : undefined
      }
      onImported={handleImported}
    >
      {activeTab === "tasks" ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-[0_1px_0_rgba(9,9,11,0.04),0_14px_35px_rgba(9,9,11,0.08)]">
          <div className="mb-4 flex w-full items-center justify-start gap-2 pl-2">
            <PrimaryButton
              ref={createButtonRef}
              type="button"
              onClick={openCreateDialog}
              disabled={isCreating}
            >
              新規タスク(N)
            </PrimaryButton>
            {TASK_FILTER_ORDER.map((source, index) => (
              <button
                key={source}
                type="button"
                aria-pressed={visibleSources[source]}
                onClick={() => toggleSourceFilter(source, setVisibleSources)}
                className={`${sourceFilterClass(source, visibleSources[source])} ${index === 0 ? "ml-2" : ""}`}
              >
                {`${sourceLabel(source)}(${countTasks(tasks, source)})`}
              </button>
            ))}
          </div>
          <RunnerHistoryPanel history={runnerHistory} />
          {error ? <Notice tone="error" message={error} /> : null}
          {isLoading ? <Notice tone="neutral" message="Loading tasks..." /> : null}
          {!error && !isLoading && visibleTasks.length === 0 ? (
            <Notice tone="neutral" message="task はありません" />
          ) : null}
          {!isLoading && visibleTasks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-1 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    <th className="px-3 whitespace-nowrap">id</th>
                    <th className="px-3 w-full">task</th>
                    <th className="pl-1 pr-3 w-[13rem] whitespace-nowrap">actions</th>
                    <th className="px-3 text-center">url</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTasks.map((task) => {
                    const upTargetId = swapTargetId(orderedTasks, task, "up");
                    const downTargetId = swapTargetId(orderedTasks, task, "down");
                    return (
                      <tr
                        key={`${task.source}-${task.id}`}
                        onClick={() => openEditDialog(task)}
                        className="group cursor-pointer"
                      >
                        <td className="rounded-l-md border-y border-l border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-[var(--muted)] whitespace-nowrap transition group-hover:bg-amber-50/70 group-focus-within:bg-amber-50/70">
                          <span
                            className={`rounded-md px-3 py-1 text-xs font-semibold uppercase ${sourceBadgeTone(task.source)}`}
                          >
                            {sourceTag(task)}
                          </span>
                        </td>
                        <td className="w-full min-w-[34rem] border-y border-[var(--border)] bg-[var(--panel-strong)] transition group-hover:bg-amber-50/70 group-focus-within:bg-amber-50/70">
                          <button
                            type="button"
                            aria-label={`task ${task.id} を編集`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditDialog(task);
                            }}
                            className="block h-full w-full px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                          >
                            <div className="space-y-1">
                              {showTaskTitle(task.title) ? (
                                <p className="font-semibold text-[var(--ink)]">{task.title}</p>
                              ) : null}
                              <p className="line-clamp-6 max-w-[56rem] whitespace-pre-wrap break-all text-black">
                                {task.action}
                              </p>
                            </div>
                          </button>
                        </td>
                        <td className="w-[13rem] whitespace-nowrap border-y border-[var(--border)] bg-[var(--panel-strong)] pl-1 pr-3 py-2 transition group-hover:bg-amber-50/70 group-focus-within:bg-amber-50/70">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditDialog(task);
                              }}
                              className="inline-flex w-[4.5rem] items-center justify-center rounded-md border border-[var(--border)] bg-white px-3 py-2 font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50"
                            >
                              編集
                            </button>
                            <PrimaryButton
                              type="button"
                              className="w-[4.5rem] border border-rose-200 bg-white !text-rose-700 hover:border-rose-300 hover:bg-rose-50 focus-visible:outline-rose-300"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDelete(task);
                              }}
                            >
                              削除
                            </PrimaryButton>
                            <SwapButton
                              label="↑"
                              ariaLabel={`task ${task.id} を上へ`}
                              disabled={isSwapping || !upTargetId}
                              onClick={() => void handleSwap(task, upTargetId)}
                            />
                            <SwapButton
                              label="↓"
                              ariaLabel={`task ${task.id} を下へ`}
                              disabled={isSwapping || !downTargetId}
                              onClick={() => void handleSwap(task, downTargetId)}
                            />
                          </div>
                        </td>
                        <td className="rounded-r-md border-y border-r border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-center transition group-hover:bg-amber-50/70 group-focus-within:bg-amber-50/70">
                          <TaskPrLink url={task.url} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
      {activeTab === "docs" && project?.repositoryPath ? (
        <ProjectDocsPanel
          isActive={activeTab === "docs"}
          projectId={projectId}
        />
      ) : null}
      {activeTab === "tasks" ? (
        <NewTaskDialog
          isOpen={isCreateOpen}
          isSaving={isCreating}
          error={createError}
          action={newTaskAction}
          title="新規タスク"
          titleIconSrc="/assets/images/square-check-big.svg"
          description=""
          submitLabel="新規作成"
          submittingLabel="作成中..."
          enableShortcut
          statusLabel="種別"
          statusValue={createTaskSource}
          statusOptions={TASK_STATUS_OPTIONS}
          onActionChange={setNewTaskAction}
          onStatusChange={handleCreateTaskSource}
          onClose={closeCreateDialog}
          onSubmit={handleCreate}
        />
      ) : null}
      {activeTab === "tasks" ? (
        <NewTaskDialog
          isOpen={isEditOpen}
          isSaving={isEditing}
          error={editError}
          action={editTaskAction}
          title={editTask ? `編集 - #${editTask.id}` : "編集"}
          titleIconSrc="/assets/images/square-check-big.svg"
          description=""
          submitLabel="更新"
          submittingLabel="更新中..."
          enableShortcut
          statusValue={editTaskSource}
          statusOptions={TASK_STATUS_OPTIONS}
          onActionChange={setEditTaskAction}
          onStatusChange={handleEditTaskSource}
          onClose={closeEditDialog}
          onSubmit={handleEdit}
        />
      ) : null}
    </PageFrame>
  );
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

async function refreshTasks(
  projectId: string,
  setTasks: (tasks: TaskRecord[]) => void,
  setRunnerHistory: (history: RunnerHistoryRecord[]) => void,
) {
  const taskData = await readTasks(projectId);
  saveTaskCache(projectId, taskData.tasks);
  saveRunnerHistoryCache(projectId, taskData.runnerHistory);
  setTasks(taskData.tasks);
  setRunnerHistory(taskData.runnerHistory);
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
  } else {
    setProject(null);
  }
}

type ProjectTabsProps = {
  repositoryName: string;
  activeTab: ProjectTab;
  onChange: (nextTab: ProjectTab) => void;
};

type ProjectHeaderActionsProps = {
  repositoryPath: string;
};

function ProjectTabs(props: ProjectTabsProps) {
  return (
    <div className="flex h-10 items-center justify-start pr-1">
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => props.onChange("tasks")}
          className={projectTabClass(props.activeTab === "tasks")}
        >
          {props.repositoryName}
        </button>
        <button
          type="button"
          onClick={() => props.onChange("docs")}
          className={projectTabClass(props.activeTab === "docs")}
        >
          docs
        </button>
      </div>
    </div>
  );
}

function ProjectHeaderActions(props: ProjectHeaderActionsProps) {
  return (
    <div className="flex h-10 items-center justify-end pr-1">
      <span aria-hidden="true" className="text-sm font-normal leading-5 text-[var(--muted)]">
        {props.repositoryPath}
      </span>
    </div>
  );
}

function projectTabClass(isActive: boolean) {
  if (isActive) {
    return "rounded-md border border-zinc-300 bg-zinc-200 px-3 py-1 text-base font-semibold text-zinc-900";
  }
  return "rounded-md border border-transparent px-3 py-1 text-base text-[var(--muted)] hover:bg-zinc-100";
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
      onClick={(event) => {
        event.stopPropagation();
      }}
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

type RunnerHistoryPanelProps = {
  history: RunnerHistoryRecord[];
};

function RunnerHistoryPanel(props: RunnerHistoryPanelProps) {
  const history = [...props.history].reverse();
  return (
    <section className="mb-4 rounded-lg border border-[var(--border)] bg-white px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--ink)]">RUNNER履歴</h2>
        <span className="text-xs text-[var(--muted)]">{history.length}件</span>
      </div>
      {history.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">履歴はありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="text-[var(--muted)]">
                <th className="px-2 py-1 font-medium">id</th>
                <th className="px-2 py-1 font-medium">datetime</th>
                <th className="px-2 py-1 font-medium">status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, index) => (
                <tr key={`${item.datetime}-${index}`} className="border-t border-[var(--border)]">
                  <td className="px-2 py-1 text-[var(--ink)]">{item.id.join(", ")}</td>
                  <td className="px-2 py-1 text-[var(--ink)]">{item.datetime}</td>
                  <td className="px-2 py-1">
                    <span className={runnerStatusClass(item.status)}>{item.status.toUpperCase()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function runnerStatusClass(status: RunnerHistoryRecord["status"]) {
  if (status === "error") {
    return "inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700";
  }
  return "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700";
}

function showTaskTitle(title: string) {
  return title.trim() !== "" && title.trim() !== "-";
}

function sourceBadgeTone(source: TaskRecord["source"]) {
  return SOURCE_META[source].badgeClass;
}

function sourceLabel(source: TaskRecord["source"]) {
  return SOURCE_META[source].label;
}

function sourceTag(task: TaskRecord) {
  return `${sourceLabel(task.source)} #${task.id}`;
}

function sourceFilterClass(source: TaskSource, active: boolean) {
  const tone = SOURCE_META[source].filterClass;
  const inactive = "border-[var(--border)] bg-white text-[var(--muted)]";
  const toneClass = active ? tone : inactive;
  return `inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold uppercase tracking-[0.08em] transition ${toneClass}`;
}

function orderTasks(tasks: TaskRecord[]) {
  return TASK_FILTER_ORDER.flatMap((source) => {
    const sort = SOURCE_META[source].descending ? compareTaskIdDesc : compareTaskIdAsc;
    return tasks.filter((task) => task.source === source).sort(sort);
  });
}

function filterTasks(tasks: TaskRecord[], visibleSources: Record<TaskSource, boolean>) {
  return tasks.filter((task) => visibleSources[task.source]);
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

function compareTaskIdAsc(left: TaskRecord, right: TaskRecord) {
  const leftId = Number(left.id);
  const rightId = Number(right.id);
  if (Number.isFinite(leftId) && Number.isFinite(rightId)) {
    return leftId - rightId;
  }
  return left.id.localeCompare(right.id, undefined, { numeric: true, sensitivity: "base" });
}

function swapTargetId(
  tasks: TaskRecord[],
  task: TaskRecord,
  direction: "up" | "down",
) {
  const sourceTasks = tasks.filter((item) => item.source === task.source);
  const index = sourceTasks.findIndex((item) => item.id === task.id);
  if (index < 0) {
    return null;
  }
  const offset = direction === "up" ? -1 : 1;
  const target = sourceTasks[index + offset];
  return target ? target.id : null;
}

type SwapButtonProps = {
  label: string;
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
};

function SwapButton(props: SwapButtonProps) {
  const { label, ariaLabel, disabled, onClick } = props;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-white text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-[var(--muted)]"
    >
      {label}
    </button>
  );
}

function isCreateShortcut(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  if (key !== "n") {
    return false;
  }
  return event.altKey || event.ctrlKey || event.metaKey;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    return true;
  }
  return target.isContentEditable;
}

function isTaskSource(value: string): value is TaskSource {
  return (
    value === "action" ||
    value === "runner" ||
    value === "pending" ||
    value === "done" ||
    value === "cancel"
  );
}

function toggleSourceFilter(
  source: TaskSource,
  setVisibleSources: Dispatch<SetStateAction<Record<TaskSource, boolean>>>,
) {
  setVisibleSources((current) => ({
    ...current,
    [source]: !current[source],
  }));
}

const TASK_FILTER_ORDER: TaskSource[] = ["action", "runner", "pending", "done", "cancel"];
const SOURCE_META: Record<
  TaskSource,
  {
    label: string;
    badgeClass: string;
    filterClass: string;
    descending: boolean;
  }
> = {
  action: {
    label: "TODO",
    badgeClass: "bg-blue-100 text-blue-700",
    filterClass: "border-blue-200 bg-blue-100 text-blue-700",
    descending: false,
  },
  runner: {
    label: "RUNNER",
    badgeClass: "bg-emerald-100 text-emerald-700",
    filterClass: "border-emerald-200 bg-emerald-100 text-emerald-700",
    descending: false,
  },
  pending: {
    label: "PENDING",
    badgeClass: "bg-amber-100 text-amber-700",
    filterClass: "border-amber-200 bg-amber-100 text-amber-700",
    descending: false,
  },
  done: {
    label: "DONE",
    badgeClass: "bg-[#dcf5e3] text-[#3f7651]",
    filterClass: "border-[#bfe7ca] bg-[#dcf5e3] text-[#3f7651]",
    descending: true,
  },
  cancel: {
    label: "CANCEL",
    badgeClass: "bg-zinc-200 text-zinc-700",
    filterClass: "border-zinc-300 bg-zinc-200 text-zinc-700",
    descending: true,
  },
};
const TASK_STATUS_OPTIONS = TASK_FILTER_ORDER.map((source) => ({
  value: source,
  label: SOURCE_META[source].label,
  toneClass: SOURCE_META[source].filterClass,
}));
