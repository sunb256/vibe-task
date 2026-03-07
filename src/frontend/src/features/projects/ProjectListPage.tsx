import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Notice } from "../../components/Notice";
import { PageFrame } from "../../components/PageFrame";
import { PrimaryButton } from "../../components/PrimaryButton";
import { createProject, fetchProjects } from "./projectApi";
import { NewProjectDialog } from "./NewProjectDialog";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";
import { type Project, type ProjectFormState } from "./types";

export function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <>
      <PageFrame
        title={
          <Link
            to="/"
            className="rounded-sm transition hover:text-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
          >
            Project 一覧
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <PrimaryButton onClick={() => setIsDialogOpen(true)}>新規プロジェクト</PrimaryButton>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50"
            >
              Setting
            </button>
          </div>
        }
      >
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {error ? <Notice tone="error" message={error} /> : null}
          {isLoading ? <Notice tone="neutral" message="Loading projects..." /> : null}
          {!error && !isLoading && projects.length === 0 ? (
            <Notice tone="neutral" message="Project はまだ登録されていません。" />
          ) : null}
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
            >
              <article className="h-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-[0_1px_0_rgba(9,9,11,0.04),0_14px_35px_rgba(9,9,11,0.08)] transition hover:-translate-y-0.5 hover:border-[var(--ink)] hover:shadow-[0_1px_0_rgba(9,9,11,0.05),0_18px_42px_rgba(9,9,11,0.12)]">
                <div className="space-y-3">
                  <div>
                    <h2 className="text-xl font-semibold">{project.name}</h2>
                    <p className="mt-1 break-all text-sm text-[var(--muted)]">
                      {project.repositoryPath}
                    </p>
                  </div>
                  <dl className="space-y-2 text-sm text-[var(--muted)]">
                    <div>
                      <dt className="font-medium text-[var(--ink)]">action-list</dt>
                      <dd>{project.actionListPath}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-[var(--ink)]">done-list</dt>
                      <dd>{project.doneListPath}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            </Link>
          ))}
        </section>
      </PageFrame>
      <NewProjectDialog
        isOpen={isDialogOpen}
        isSaving={isSaving}
        error={dialogError}
        onClose={() => {
          setDialogError("");
          setIsDialogOpen(false);
        }}
        onSubmit={handleCreate}
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
