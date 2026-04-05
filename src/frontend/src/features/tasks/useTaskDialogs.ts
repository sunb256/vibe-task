import { type RefObject, useState } from "react";

import type { TaskRecord, TaskSource } from "./types";

type UseTaskDialogsResult = {
  createError: string;
  editError: string;
  isCreateOpen: boolean;
  isEditOpen: boolean;
  isCreating: boolean;
  isEditing: boolean;
  newTaskAction: string;
  createTaskSource: TaskSource;
  editTask: TaskRecord | null;
  editTaskAction: string;
  editTaskSource: TaskSource;
  setCreateError: (message: string) => void;
  setEditError: (message: string) => void;
  setIsCreating: (value: boolean) => void;
  setIsEditing: (value: boolean) => void;
  setNewTaskAction: (value: string) => void;
  setEditTaskAction: (value: string) => void;
  openCreateDialog: () => void;
  openCreateRunnerDialog: () => void;
  closeCreateDialog: () => void;
  openEditDialog: (task: TaskRecord) => void;
  closeEditDialog: () => void;
  completeCreateDialog: () => void;
  completeEditDialog: () => void;
  handleCreateTaskSource: (status: string) => void;
  handleEditTaskSource: (status: string) => void;
};

const defaultTaskAction = "";

export function useTaskDialogs(
  createButtonRef: RefObject<HTMLButtonElement | null>,
): UseTaskDialogsResult {
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newTaskAction, setNewTaskAction] = useState(defaultTaskAction);
  const [createTaskSource, setCreateTaskSource] = useState<TaskSource>("action");
  const [editTask, setEditTask] = useState<TaskRecord | null>(null);
  const [editTaskAction, setEditTaskAction] = useState("");
  const [editTaskSource, setEditTaskSource] = useState<TaskSource>("action");

  function openCreate(source: TaskSource) {
    setCreateError("");
    setNewTaskAction(defaultTaskAction);
    setCreateTaskSource(source);
    setIsCreateOpen(true);
  }

  function openCreateDialog() {
    openCreate("action");
  }

  function openCreateRunnerDialog() {
    openCreate("runner");
  }

  function closeCreateDialog() {
    if (isCreating) {
      return;
    }
    setCreateError("");
    setIsCreateOpen(false);
    setCreateTaskSource("action");
    createButtonRef.current?.focus();
  }

  function completeCreateDialog() {
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

  function completeEditDialog() {
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

  return {
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
  };
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
