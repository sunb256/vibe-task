import { useEffect, useMemo, useState } from "react";

import { ListStateNotice } from "../../components/ListStateNotice";
import { PageFrame } from "../../components/PageFrame";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { displayPath } from "../../lib/displayPath";
import { normalizeQuery } from "../../lib/normalizeQuery";
import { readErrorMessage } from "../../lib/readErrorMessage";
import { NewTaskDialog } from "../tasks/NewTaskDialog";
import { createSkill, deleteSkill, fetchSkill, fetchSkills, updateSkill } from "./skillApi";
import type { SkillFile, SkillSummary } from "./types";

const emptyContent = "";

export function SkillsPage() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createContent, setCreateContent] = useState(emptyContent);
  const [editSkill, setEditSkill] = useState<SkillFile | null>(null);
  const [editContent, setEditContent] = useState(emptyContent);
  const visibleSkills = useMemo(() => filterSkills(skills, searchQuery), [skills, searchQuery]);

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
      setError(readErrorMessage(loadError, "Skill 一覧の取得に失敗しました。"));
    } finally {
      setIsLoading(false);
    }
  }

  async function openEditDialog(skill: SkillSummary) {
    setIsLoadingEditor(true);
    setError("");
    setEditError("");
    try {
      const loaded = await fetchSkill(skill.name, skill);
      setEditSkill(loaded);
      setEditContent(loaded.content);
      setIsEditOpen(true);
    } catch (loadError) {
      setError(readErrorMessage(loadError, "Skill の読み込みに失敗しました。"));
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

  function openCreateDialog() {
    setCreateError("");
    setCreateName("");
    setCreateContent(emptyContent);
    setIsCreateOpen(true);
  }

  function closeCreateDialog() {
    if (isCreating) {
      return;
    }
    setCreateError("");
    setIsCreateOpen(false);
  }

  async function handleCreate() {
    const skillName = createName.trim();
    if (!skillName) {
      setCreateError("Skill名を入力してください。");
      return;
    }
    setIsCreating(true);
    setCreateError("");
    setError("");
    try {
      const content = buildCreateSkillContent(skillName, createContent);
      const created = await createSkill(skillName, content);
      setEditSkill(created);
      setEditContent(created.content);
      setIsCreateOpen(false);
      setIsEditOpen(true);
      await loadSkills();
    } catch (createError) {
      setCreateError(readErrorMessage(createError, "Skill の作成に失敗しました。"));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdate() {
    if (!editSkill) {
      return;
    }
    const ok = window.confirm(`Skill ${editSkill.name} を更新しますか？`);
    if (!ok) {
      return;
    }
    setIsSaving(true);
    setEditError("");
    try {
      await updateSkill(editSkill.name, editContent, editSkill);
      resetEditor();
      await loadSkills();
    } catch (saveError) {
      setEditError(readErrorMessage(saveError, "Skill の更新に失敗しました。"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(skill: SkillSummary) {
    const ok = window.confirm(`Skill ${skill.name} を削除しますか？`);
    if (!ok) {
      return;
    }
    setIsDeleting(true);
    setError("");
    try {
      await deleteSkill(skill.name, skill);
      await loadSkills();
    } catch (deleteError) {
      setError(readErrorMessage(deleteError, "Skill の削除に失敗しました。"));
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
          <div className="mb-4 flex w-full items-center justify-between gap-2">
            <SearchInput
              id="skill-search"
              value={searchQuery}
              autoFocus
              onChange={setSearchQuery}
              wrapperClassName="w-full min-w-48 max-w-64"
            />
            <div className="flex shrink-0 items-center justify-end">
              <PrimaryButton
                type="button"
                onClick={openCreateDialog}
                disabled={isCreating}
                className="whitespace-nowrap"
              >
                新規Skill
              </PrimaryButton>
            </div>
          </div>
          <ListStateNotice
            error={error}
            isLoading={isLoading}
            hasItems={skills.length > 0}
            hasVisibleItems={visibleSkills.length > 0}
            loadingMessage="Loading skills..."
            emptyMessage="Skill は見つかりませんでした。"
            noMatchMessage="検索条件に一致するSkillはありません。"
          />
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
                if (event.target !== event.currentTarget) {
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
        isOpen={isCreateOpen}
        isSaving={isCreating}
        error={createError}
        action={createContent}
        title="新規Skill"
        titleIconSrc="/assets/images/file-text.svg"
        description=""
        submitLabel="新規作成"
        submittingLabel="作成中..."
        autoFocusEditor={false}
        enableShortcut
        extraFields={
          <div className="grid gap-2">
            <label htmlFor="new-skill-name" className="text-sm font-semibold text-[var(--ink)]">
              name
            </label>
            <input
              id="new-skill-name"
              type="text"
              autoFocus
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/12"
            />
          </div>
        }
        onActionChange={setCreateContent}
        onClose={closeCreateDialog}
        onSubmit={handleCreate}
      />
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

function buildCreateSkillContent(skillName: string, content: string) {
  if (content.trim()) {
    return content;
  }
  return `# ${skillName}\n`;
}

function filterSkills(skills: SkillSummary[], searchQuery: string) {
  const query = normalizeQuery(searchQuery);
  if (!query) {
    return skills;
  }
  return skills.filter((skill) => skillMatchesQuery(skill, query));
}

function skillMatchesQuery(skill: SkillSummary, query: string) {
  const path = skill.path.toLowerCase();
  const visiblePath = displayPath(skill.path).toLowerCase();
  const projectName = skill.projectName.toLowerCase();

  return (
    skill.name.toLowerCase().includes(query) ||
    path.includes(query) ||
    visiblePath.includes(query) ||
    projectName.includes(query)
  );
}
