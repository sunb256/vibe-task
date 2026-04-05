import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { PageFrame } from "../../components/PageFrame";
import { readErrorMessage } from "../../lib/readErrorMessage";
import { NewTaskDialog } from "./NewTaskDialog";
import {
  DocsTabPanel,
  RunnerTabPanel,
  type RunnerTab,
  TaskTabPanel,
} from "./ProjectTasksTabPanels";
import { TASK_STATUS_OPTIONS, filterTaskSearch, filterTasks, orderTasks } from "./taskPanelUtils";
import {
  cancelRunner,
  createTask,
  deleteTask,
  executeRunner,
  swapTaskId,
  updateTask,
} from "./taskApi";
import type { TaskRecord, TaskSource } from "./types";
import { useProjectTasksData } from "./useProjectTasksData";
import { useRunnerPolling } from "./useRunnerPolling";
import { useTaskDialogs } from "./useTaskDialogs";

type ProjectTab = "tasks" | "runner" | "docs";

const defaultVisibleSources: Record<TaskSource, boolean> = {
  action: true,
  runner: false,
  pending: true,
  done: false,
  cancel: false,
};

export function ProjectTasksPage() {
  const { projectId = "" } = useParams();
  const [activeTab, setActiveTab] = useState<ProjectTab>("tasks");
  const [activeRunnerTab, setActiveRunnerTab] = useState<RunnerTab>("list");
  const [isRunnerStarting, setIsRunnerStarting] = useState(false);
  const [isRunnerCanceling, setIsRunnerCanceling] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [visibleSources, setVisibleSources] = useState(defaultVisibleSources);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const {
    createError,
    editError,
    isCreateOpen,
    isEditOpen,
    isCreating,
    isEditing,
    newTaskAction,
    createTaskSource,
    editTask,
    editTaskAction,
    editTaskSource,
    setCreateError,
    setEditError,
    setIsCreating,
    setIsEditing,
    setNewTaskAction,
    setEditTaskAction,
    openCreateDialog,
    openCreateRunnerDialog,
    closeCreateDialog,
    openEditDialog,
    closeEditDialog,
    completeCreateDialog,
    completeEditDialog,
    handleCreateTaskSource,
    handleEditTaskSource,
  } = useTaskDialogs(createButtonRef);

  const pauseAutoRefresh =
    isCreateOpen ||
    isEditOpen ||
    isCreating ||
    isEditing ||
    isRunnerStarting ||
    isRunnerCanceling;
  const { project, tasks, runnerHistory, error, isLoading, setError, refreshTasksData, handleImported } =
    useProjectTasksData({
      projectId,
      activeTab,
      pauseAutoRefresh,
    });
  const {
    runnerLog,
    runnerLogError,
    isRunnerRunning,
    setRunnerLogError,
    setIsRunnerRunning,
    refreshRunnerLog,
  } = useRunnerPolling({
    projectId,
    activeTab,
    activeRunnerTab,
    onRunnerStopped: refreshTasksData,
  });

  useEffect(() => {
    setActiveTab("tasks");
    setTaskSearchQuery("");
  }, [projectId]);

  useEffect(() => {
    setActiveRunnerTab("list");
  }, [projectId]);

  async function handleDelete(task: TaskRecord) {
    const ok = window.confirm(`task ${task.id} を削除しますか？`);
    if (!ok) {
      return;
    }

    try {
      await deleteTask(projectId, task.source, task.id);
      await refreshTasksData();
    } catch (deleteError) {
      setError(readErrorMessage(deleteError, "タスクの削除に失敗しました。"));
    }
  }

  async function handleCopy(task: TaskRecord) {
    const ok = window.confirm(`task ${task.id} をコピーしますか？`);
    if (!ok) {
      return;
    }

    setError("");
    try {
      const created = await createTask(projectId, task.source);
      await updateTask(projectId, created.source, created.id, task.action);
      await refreshTasksData();
    } catch (copyError) {
      setError(readErrorMessage(copyError, "task のコピーに失敗しました。"));
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
      await refreshTasksData();
    } catch (swapError) {
      setError(readErrorMessage(swapError, "task の並び替えに失敗しました。"));
    } finally {
      setIsSwapping(false);
    }
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
      openCreateDialog();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTab, isCreateOpen, isEditOpen, isCreating, isEditing, openCreateDialog]);

  async function handleCreate() {
    setIsCreating(true);
    setCreateError("");
    try {
      const created = await createTask(projectId, createTaskSource);
      await updateTask(projectId, created.source, created.id, newTaskAction);
      await refreshTasksData();
      completeCreateDialog();
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
      await refreshTasksData();
      completeEditDialog();
    } catch (saveError) {
      setEditError(readErrorMessage(saveError, "task の更新に失敗しました。"));
    } finally {
      setIsEditing(false);
    }
  }

  async function handleRunnerExecute() {
    const confirmed = window.confirm("RUNNERを実行しますか？");
    if (!confirmed) {
      return;
    }

    setActiveRunnerTab("log");
    setRunnerLogError("");
    setIsRunnerStarting(true);
    try {
      await executeRunner(projectId);
      await refreshRunnerLog();
    } catch (runnerError) {
      setRunnerLogError(readErrorMessage(runnerError, "runner の実行に失敗しました。"));
    } finally {
      setIsRunnerStarting(false);
    }
  }

  async function handleRunnerCancel() {
    const confirmed = window.confirm("Runnerをキャンセルしますか？");
    if (!confirmed) {
      return;
    }

    setRunnerLogError("");
    setIsRunnerCanceling(true);
    try {
      await cancelRunner(projectId);
      setIsRunnerRunning(false);
      setActiveRunnerTab("log");
      await refreshRunnerLog();
      await refreshTasksData();
    } catch (cancelError) {
      setRunnerLogError(readErrorMessage(cancelError, "runner のキャンセルに失敗しました。"));
    } finally {
      setIsRunnerCanceling(false);
    }
  }

  async function handleRunnerAction() {
    if (isRunnerRunning) {
      await handleRunnerCancel();
      return;
    }
    await handleRunnerExecute();
  }

  const orderedTasks = orderTasks(tasks);
  const visibleTasks = filterTasks(orderedTasks, visibleSources);
  const filteredTasks = filterTaskSearch(visibleTasks, taskSearchQuery);
  const runnerTasks = orderedTasks.filter((task) => task.source === "runner");

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
        <TaskTabPanel
          tasks={tasks}
          orderedTasks={orderedTasks}
          visibleTasks={visibleTasks}
          filteredTasks={filteredTasks}
          visibleSources={visibleSources}
          taskSearchQuery={taskSearchQuery}
          isCreating={isCreating}
          isLoading={isLoading}
          isSwapping={isSwapping}
          error={error}
          createButtonRef={createButtonRef}
          onTaskSearchChange={setTaskSearchQuery}
          onToggleSource={(source) => {
            setVisibleSources((current) => ({
              ...current,
              [source]: !current[source],
            }));
          }}
          onOpenCreateDialog={openCreateDialog}
          onEdit={openEditDialog}
          onCopy={(task) => void handleCopy(task)}
          onDelete={(task) => void handleDelete(task)}
          onSwap={(task, targetId) => void handleSwap(task, targetId)}
        />
      ) : null}
      {activeTab === "runner" ? (
        <RunnerTabPanel
          activeRunnerTab={activeRunnerTab}
          setActiveRunnerTab={setActiveRunnerTab}
          error={error}
          isLoading={isLoading}
          isCreating={isCreating}
          isRunnerStarting={isRunnerStarting}
          isRunnerCanceling={isRunnerCanceling}
          isRunnerRunning={isRunnerRunning}
          isSwapping={isSwapping}
          orderedTasks={orderedTasks}
          runnerTasks={runnerTasks}
          runnerLog={runnerLog}
          runnerLogError={runnerLogError}
          runnerHistory={runnerHistory}
          onOpenCreateRunnerDialog={openCreateRunnerDialog}
          onRunnerAction={() => void handleRunnerAction()}
          onEdit={openEditDialog}
          onCopy={(task) => void handleCopy(task)}
          onDelete={(task) => void handleDelete(task)}
          onSwap={(task, targetId) => void handleSwap(task, targetId)}
        />
      ) : null}
      {activeTab === "docs" && project?.repositoryPath ? <DocsTabPanel projectId={projectId} /> : null}
      {activeTab !== "docs" ? (
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
      {activeTab !== "docs" ? (
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
          onClick={() => props.onChange("runner")}
          className={projectTabClass(props.activeTab === "runner")}
        >
          Runner
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
