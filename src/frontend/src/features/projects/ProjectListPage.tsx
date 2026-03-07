import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Notice } from "../../components/Notice";
import { PageFrame } from "../../components/PageFrame";
import { PrimaryButton } from "../../components/PrimaryButton";
import { createProject, fetchProjects } from "./projectApi";
import { NewProjectDialog } from "./NewProjectDialog";
import { type Project, type ProjectFormState } from "./types";

export function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
        title="Projects"
        eyebrow={null}
        actions={<PrimaryButton onClick={() => setIsDialogOpen(true)}>NEW</PrimaryButton>}
      >
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {error ? <Notice tone="error" message={error} /> : null}
          {isLoading ? <Notice tone="neutral" message="Loading projects..." /> : null}
          {!error && !isLoading && projects.length === 0 ? (
            <Notice tone="neutral" message="Project はまだ登録されていません。" />
          ) : null}
          {projects.map((project) => (
            <article
              key={project.id}
              className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_18px_50px_rgba(31,43,46,0.08)] backdrop-blur"
            >
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
                <Link
                  to={`/projects/${project.id}`}
                  className="inline-flex rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/8"
                >
                  Open Project
                </Link>
              </div>
            </article>
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
    </>
  );
}

function readError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
