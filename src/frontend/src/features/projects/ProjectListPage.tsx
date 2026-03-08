import {
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { Notice } from "../../components/Notice";
import { PageFrame } from "../../components/PageFrame";
import { PrimaryButton } from "../../components/PrimaryButton";
import {
  createProject,
  deleteProject,
  fetchProjects,
  reorderProjects,
  updateProject,
} from "./projectApi";
import { NewProjectDialog } from "./NewProjectDialog";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";
import { defaultProjectForm, type Project, type ProjectFormState } from "./types";

export function ProjectListPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [editError, setEditError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const [dropProjectId, setDropProjectId] = useState<string | null>(null);
  const dragProjectIdRef = useRef<string | null>(null);
  const visibleProjects = useMemo(
    () => filterProjects(projects, searchQuery),
    [projects, searchQuery],
  );
  const editForm = useMemo(
    () => (editProject ? toFormState(editProject) : defaultProjectForm),
    [editProject],
  );

  useEffect(() => {
    void loadProjects();
  }, []);

  async function loadProjects() {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetchProjects();
      setProjects(response.projects);
    } catch (loadError) {
      setError(readError(loadError, "プロジェクト一覧の取得に失敗しました。"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(form: ProjectFormState) {
    setIsSaving(true);
    setDialogError("");
    try {
      await createProject(form);
      setIsDialogOpen(false);
      await loadProjects();
    } catch (saveError) {
      setDialogError(readError(saveError, "プロジェクトの保存に失敗しました。"));
    } finally {
      setIsSaving(false);
    }
  }

  function openEditDialog(project: Project) {
    setEditError("");
    setEditProject(project);
    setIsEditOpen(true);
  }

  function closeEditDialog() {
    if (isUpdating) {
      return;
    }
    setEditError("");
    setIsEditOpen(false);
    setEditProject(null);
  }

  async function handleUpdate(form: ProjectFormState) {
    if (!editProject) {
      return;
    }
    setIsUpdating(true);
    setEditError("");
    try {
      await updateProject(editProject.id, form);
      setIsEditOpen(false);
      setEditProject(null);
      await loadProjects();
    } catch (saveError) {
      setEditError(readError(saveError, "プロジェクトの更新に失敗しました。"));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete(project: Project) {
    const ok = window.confirm(`プロジェクト #${project.id} (${project.name}) を削除しますか？`);
    if (!ok) {
      return;
    }
    setIsDeleting(true);
    setError("");
    try {
      await deleteProject(project.id);
      await loadProjects();
    } catch (deleteError) {
      setError(readError(deleteError, "プロジェクトの削除に失敗しました。"));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleReorder(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return;
    }
    setIsReordering(true);
    setError("");
    try {
      await reorderProjects(sourceId, targetId);
      await loadProjects();
    } catch (reorderError) {
      setError(readError(reorderError, "プロジェクトの並び替えに失敗しました。"));
    } finally {
      setIsReordering(false);
    }
  }

  function handleDragStart(event: DragEvent<HTMLElement>, projectId: string) {
    if (isReordering) {
      event.preventDefault();
      return;
    }
    dragProjectIdRef.current = projectId;
    setDragProjectId(projectId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", projectId);
  }

  function handleDragOver(event: DragEvent<HTMLElement>, projectId: string) {
    const sourceId = dragProjectIdRef.current || event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === projectId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropProjectId(projectId);
  }

  async function handleDrop(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    const sourceId =
      dragProjectIdRef.current || dragProjectId || event.dataTransfer.getData("text/plain");
    dragProjectIdRef.current = null;
    setDragProjectId(null);
    setDropProjectId(null);
    if (!sourceId || sourceId === targetId) {
      return;
    }
    await handleReorder(sourceId, targetId);
  }

  function handleDragEnd() {
    dragProjectIdRef.current = null;
    setDragProjectId(null);
    setDropProjectId(null);
  }

  function handleCardClick(event: MouseEvent<HTMLElement>, projectId: string) {
    if (isReordering || isInteractiveTarget(event.target)) {
      return;
    }
    navigate(`/projects/${projectId}`);
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, projectId: string) {
    if (isInteractiveTarget(event.target)) {
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    navigate(`/projects/${projectId}`);
  }

  return (
    <>
      <PageFrame
        eyebrow={null}
        headerStyle="plain"
        title={<span className="inline-flex h-9 items-center pl-1">Project 一覧</span>}
        actions={
          <div className="flex w-full items-center justify-between gap-2">
            <div className="relative w-full min-w-48 max-w-64">
              <img
                src="/assets/images/search.svg"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-65"
              />
              <input
                id="project-search"
                type="search"
                aria-label="Search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search"
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/12"
              />
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <PrimaryButton className="whitespace-nowrap" onClick={() => setIsDialogOpen(true)}>
                新規プロジェクト
              </PrimaryButton>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="whitespace-nowrap rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50"
              >
                Setting
              </button>
            </div>
          </div>
        }
      >
        <section className="space-y-3">
          {error ? <Notice tone="error" message={error} /> : null}
          {isLoading ? <Notice tone="neutral" message="Loading projects..." /> : null}
          {!error && !isLoading && projects.length === 0 ? (
            <Notice tone="neutral" message="Project はまだ登録されていません。" />
          ) : null}
          {!error && !isLoading && projects.length > 0 && visibleProjects.length === 0 ? (
            <Notice tone="neutral" message="検索条件に一致するProjectはありません。" />
          ) : null}
          {visibleProjects.map((project) => (
            <article
              key={project.id}
              draggable={!isReordering}
              onDragStart={(event) => handleDragStart(event, project.id)}
              onDragOver={(event) => handleDragOver(event, project.id)}
              onDrop={(event) => void handleDrop(event, project.id)}
              onDragEnd={handleDragEnd}
              onClick={(event) => handleCardClick(event, project.id)}
              onKeyDown={(event) => handleCardKeyDown(event, project.id)}
              role="link"
              tabIndex={0}
              aria-label={`${project.name} を開く`}
              className={`cursor-pointer rounded-xl border bg-[var(--panel-strong)] pl-6 pr-4 py-3 shadow-[0_1px_0_rgba(9,9,11,0.04),0_14px_35px_rgba(9,9,11,0.08)] transition hover:border-slate-300 hover:bg-zinc-50/40 hover:shadow-[0_1px_0_rgba(9,9,11,0.05),0_18px_42px_rgba(9,9,11,0.12)] ${
                dropProjectId === project.id && dragProjectId !== project.id
                  ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <img
                      src="/assets/images/code-xml.svg"
                      alt=""
                      aria-hidden="true"
                      className="mt-[2px] h-5 w-5 shrink-0 text-[var(--muted)]"
                    />
                    <span className="truncate">{project.name}</span>
                  </h2>
                  <p className="mt-2 flex items-start gap-2 break-all text-sm text-[var(--muted)]">
                    <img
                      src="/assets/images/git-branch.svg"
                      alt=""
                      aria-hidden="true"
                      className="mt-[2px] h-4 w-4 shrink-0"
                    />
                    <span>{project.repositoryPath}</span>
                  </p>
                </div>
                <div className="flex shrink-0 justify-end gap-2 sm:pt-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditDialog(project);
                    }}
                    className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDelete(project);
                    }}
                    className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    削除
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </PageFrame>
      <NewProjectDialog
        isOpen={isDialogOpen}
        isSaving={isSaving}
        error={dialogError}
        title="新規作成"
        submitLabel="プロジェクト作成"
        submittingLabel="Saving..."
        initialForm={defaultProjectForm}
        onClose={() => {
          setDialogError("");
          setIsDialogOpen(false);
        }}
        onSubmit={handleCreate}
      />
      <NewProjectDialog
        isOpen={isEditOpen}
        isSaving={isUpdating}
        error={editError}
        title={editProject ? `プロジェクト編集 - #${editProject.id}` : "プロジェクト編集"}
        submitLabel="更新"
        submittingLabel="更新中..."
        initialForm={editForm}
        onClose={closeEditDialog}
        onSubmit={handleUpdate}
      />
      <ProjectSettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onImported={loadProjects}
      />
    </>
  );
}

function readError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function toFormState(project: Project): ProjectFormState {
  return {
    name: project.name,
    repositoryPath: project.repositoryPath,
    actionListPath: project.actionListPath,
    doneListPath: project.doneListPath,
  };
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("button,input,textarea,select,label,[role='button']"));
}

function filterProjects(projects: Project[], searchQuery: string) {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return projects;
  }
  return projects.filter((project) => {
    const name = project.name.toLowerCase();
    const repositoryPath = project.repositoryPath.toLowerCase();
    const actionListPath = project.actionListPath.toLowerCase();
    const doneListPath = project.doneListPath.toLowerCase();
    return (
      name.includes(query) ||
      repositoryPath.includes(query) ||
      actionListPath.includes(query) ||
      doneListPath.includes(query)
    );
  });
}
