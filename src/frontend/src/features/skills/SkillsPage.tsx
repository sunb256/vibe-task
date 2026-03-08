import { useEffect, useMemo, useState } from "react";

import { Notice } from "../../components/Notice";
import { PageFrame } from "../../components/PageFrame";
import { PrimaryButton } from "../../components/PrimaryButton";
import { NewTaskDialog } from "../tasks/NewTaskDialog";
import {
  createSkill,
  deleteSkillByPath,
  fetchSkillByPath,
  fetchSkills,
  updateSkillByPath,
} from "./skillApi";
import type { SkillFile, SkillSummary } from "./types";

const emptyContent = "";

export function SkillsPage() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPathSearchEnabled, setIsPathSearchEnabled] = useState(false);
  const [editSkill, setEditSkill] = useState<SkillFile | null>(null);
  const [editContent, setEditContent] = useState(emptyContent);
  const visibleSkills = useMemo(
    () => filterSkills(skills, searchQuery, isPathSearchEnabled),
    [skills, searchQuery, isPathSearchEnabled],
  );

  useEffect(() => {
    void loadSkills();
  }, []);

  async function loadSkills() {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetchSkills();
      setSkills(response.skills);
    } catch (loadError) {
      setError(readError(loadError, "Skill 一覧の取得に失敗しました。"));
    } finally {
      setIsLoading(false);
    }
  }

  async function openEditDialog(skill: SkillSummary) {
    setIsLoadingEditor(true);
    setError("");
    setEditError("");
    try {
      const loaded = await fetchSkillByPath(skill.path);
      setEditSkill(loaded);
      setEditContent(loaded.content);
      setIsEditOpen(true);
    } catch (loadError) {
      setError(readError(loadError, "Skill の読み込みに失敗しました。"));
    } finally {
      setIsLoadingEditor(false);
    }
  }

  function closeEditDialog() {
    if (isSaving || isLoadingEditor) {
      return;
    }
    resetEditor();
  }

  function resetEditor() {
    setEditError("");
    setIsEditOpen(false);
    setEditSkill(null);
    setEditContent(emptyContent);
  }

  async function handleCreate() {
    const name = window.prompt("Skill名を入力してください。");
    if (name === null) {
      return;
    }
    const skillName = name.trim();
    if (!skillName) {
      setError("Skill名を入力してください。");
      return;
    }
    setIsCreating(true);
    setError("");
    try {
      const created = await createSkill(skillName, `# ${skillName}\n`);
      setEditSkill(created);
      setEditContent(created.content);
      setIsEditOpen(true);
      await loadSkills();
    } catch (createError) {
      setError(readError(createError, "Skill の作成に失敗しました。"));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdate() {
    if (!editSkill) {
      return;
    }
    if (editSkill.source === "project") {
      const ok = window.confirm(
        `プロジェクト配下のSkillを更新します。続行しますか？\n${editSkill.path}`,
      );
      if (!ok) {
        return;
      }
    }
    setIsSaving(true);
    setEditError("");
    try {
      await updateSkillByPath(editSkill.path, editContent);
      resetEditor();
      await loadSkills();
    } catch (saveError) {
      setEditError(readError(saveError, "Skill の更新に失敗しました。"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(skill: SkillSummary) {
    const message =
      skill.source === "project"
        ? `プロジェクト配下のSkillを削除します。続行しますか？\n${skill.path}`
        : `Skill ${skill.name} を削除しますか？`;
    const ok = window.confirm(message);
    if (!ok) {
      return;
    }
    setIsDeleting(true);
    setError("");
    try {
      await deleteSkillByPath(skill.path);
      if (editSkill && editSkill.path === skill.path) {
        resetEditor();
      }
      await loadSkills();
    } catch (deleteError) {
      setError(readError(deleteError, "Skill の削除に失敗しました。"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <PageFrame
        eyebrow={null}
        title={<span className="inline-flex h-9 items-center pl-1">Skills</span>}
      >
        <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-[0_1px_0_rgba(9,9,11,0.04),0_14px_35px_rgba(9,9,11,0.08)]">
          <div className="mb-4 flex w-full items-start justify-between gap-2">
            <div className="w-full min-w-48 max-w-72 space-y-2">
              <div className="relative">
                <img
                  src="/assets/images/search.svg"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-65"
                />
                <input
                  id="skill-search"
                  type="search"
                  aria-label="Search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search"
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/12"
                />
              </div>
              <label
                htmlFor="skill-search-path"
                className="inline-flex select-none items-center gap-2 pl-1 text-xs font-medium text-[var(--muted)]"
              >
                <input
                  id="skill-search-path"
                  type="checkbox"
                  checked={isPathSearchEnabled}
                  onChange={(event) => setIsPathSearchEnabled(event.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]/30"
                />
                ファイルパスも検索
              </label>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <PrimaryButton type="button" onClick={() => void handleCreate()} disabled={isCreating}>
                新規Skill
              </PrimaryButton>
            </div>
          </div>
          {error ? <Notice tone="error" message={error} /> : null}
          {isLoading ? <Notice tone="neutral" message="Loading skills..." /> : null}
          {!error && !isLoading && skills.length === 0 ? (
            <Notice tone="neutral" message="Skill は見つかりませんでした。" />
          ) : null}
          {!error && !isLoading && skills.length > 0 && visibleSkills.length === 0 ? (
            <Notice tone="neutral" message="検索条件に一致するSkillはありません。" />
          ) : null}
          {visibleSkills.map((skill) => (
            <article
              key={skill.path}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (isLoadingEditor) {
                  return;
                }
                void openEditDialog(skill);
              }}
              onKeyDown={(event) => {
                if (isLoadingEditor) {
                  return;
                }
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }
                event.preventDefault();
                void openEditDialog(skill);
              }}
              className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] pl-6 pr-4 py-3 shadow-[0_1px_0_rgba(9,9,11,0.04),0_14px_35px_rgba(9,9,11,0.08)] transition hover:border-amber-200 hover:bg-amber-50/60 hover:shadow-[0_1px_0_rgba(9,9,11,0.05),0_18px_42px_rgba(9,9,11,0.12)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <img
                      src="/assets/images/code-xml.svg"
                      alt=""
                      aria-hidden="true"
                      className="mt-[2px] h-5 w-5 shrink-0 text-[var(--muted)]"
                    />
                    <span className="truncate">{skill.name}</span>
                  </h2>
                  <p className="mt-2 flex items-start gap-2 break-all text-sm text-[var(--muted)]">
                    <img
                      src="/assets/images/file-text.svg"
                      alt=""
                      aria-hidden="true"
                      className="mt-[2px] h-4 w-4 shrink-0"
                    />
                    <span>{displayPath(skill.path)}</span>
                  </p>
                  {skill.source === "project" ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                      Project: {skill.projectName}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 justify-end gap-2">
                  <button
                    type="button"
                    disabled={isLoadingEditor}
                    onClick={(event) => {
                      event.stopPropagation();
                      void openEditDialog(skill);
                    }}
                    className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDelete(skill);
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
      <NewTaskDialog
        isOpen={isEditOpen}
        isSaving={isSaving}
        error={editError}
        action={editContent}
        title={editSkill ? `編集 - ${editSkill.name}` : "編集"}
        titleIconSrc="/assets/images/file-text.svg"
        description=""
        submitLabel="更新"
        submittingLabel="更新中..."
        enableShortcut
        onActionChange={setEditContent}
        onClose={closeEditDialog}
        onSubmit={handleUpdate}
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

function displayPath(path: string) {
  const linuxHome = /^\/home\/[^/]+(\/.*)?$/.exec(path);
  if (linuxHome) {
    return `$HOME${linuxHome[1] ?? ""}`;
  }
  const macHome = /^\/Users\/[^/]+(\/.*)?$/.exec(path);
  if (macHome) {
    return `$HOME${macHome[1] ?? ""}`;
  }
  return path;
}

function filterSkills(skills: SkillSummary[], query: string, includePath: boolean) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return skills;
  }
  return skills.filter((skill) => {
    const fields = [skill.name, skill.projectName, skill.source];
    if (includePath) {
      fields.push(skill.path);
    }
    return fields.some((value) => value.toLowerCase().includes(normalized));
  });
}
