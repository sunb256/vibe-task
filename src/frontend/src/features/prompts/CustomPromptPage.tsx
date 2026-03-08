import { useEffect, useState } from "react";

import { Notice } from "../../components/Notice";
import { PageFrame } from "../../components/PageFrame";
import { readErrorMessage } from "../../lib/readErrorMessage";
import { NewTaskDialog } from "../tasks/NewTaskDialog";
import { deletePrompt, fetchPrompt, fetchPrompts, updatePrompt } from "./promptApi";
import type { PromptFile, PromptSummary } from "./types";

const emptyContent = "";

export function CustomPromptPage() {
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState<PromptFile | null>(null);
  const [editContent, setEditContent] = useState(emptyContent);

  useEffect(() => {
    void loadPrompts();
  }, []);

  async function loadPrompts() {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetchPrompts();
      setPrompts(response.prompts);
    } catch (loadError) {
      setError(readErrorMessage(loadError, "Prompt 一覧の取得に失敗しました。"));
    } finally {
      setIsLoading(false);
    }
  }

  async function openEditDialog(prompt: PromptSummary) {
    setIsLoadingEditor(true);
    setError("");
    setEditError("");
    try {
      const loaded = await fetchPrompt(prompt.name);
      setEditPrompt(loaded);
      setEditContent(loaded.content);
      setIsEditOpen(true);
    } catch (loadError) {
      setError(readErrorMessage(loadError, "Prompt の読み込みに失敗しました。"));
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
    setEditPrompt(null);
    setEditContent(emptyContent);
  }

  async function handleUpdate() {
    if (!editPrompt) {
      return;
    }
    setIsSaving(true);
    setEditError("");
    try {
      await updatePrompt(editPrompt.name, editContent);
      resetEditor();
      await loadPrompts();
    } catch (saveError) {
      setEditError(readErrorMessage(saveError, "Prompt の更新に失敗しました。"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(prompt: PromptSummary) {
    const ok = window.confirm(`${prompt.name} を削除しますか？`);
    if (!ok) {
      return;
    }
    setIsDeleting(true);
    setError("");
    try {
      await deletePrompt(prompt.name);
      await loadPrompts();
    } catch (deleteError) {
      setError(readErrorMessage(deleteError, "Prompt の削除に失敗しました。"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <PageFrame
        eyebrow={null}
        title={<span className="inline-flex h-9 items-center pl-1">Custom Prompt</span>}
      >
        <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-[0_1px_0_rgba(9,9,11,0.04),0_14px_35px_rgba(9,9,11,0.08)]">
          {error ? <Notice tone="error" message={error} /> : null}
          {isLoading ? <Notice tone="neutral" message="Loading prompts..." /> : null}
          {!error && !isLoading && prompts.length === 0 ? (
            <Notice tone="neutral" message="Prompt は見つかりませんでした。" />
          ) : null}
          {prompts.map((prompt) => (
            <article
              key={prompt.name}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (isLoadingEditor) {
                  return;
                }
                void openEditDialog(prompt);
              }}
              onKeyDown={(event) => {
                if (isLoadingEditor) {
                  return;
                }
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }
                event.preventDefault();
                void openEditDialog(prompt);
              }}
              className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] pl-6 pr-4 py-3 shadow-[0_1px_0_rgba(9,9,11,0.04),0_14px_35px_rgba(9,9,11,0.08)] transition hover:border-amber-200 hover:bg-amber-50/60 hover:shadow-[0_1px_0_rgba(9,9,11,0.05),0_18px_42px_rgba(9,9,11,0.12)]"
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
                    <span className="truncate">{prompt.name}</span>
                  </h2>
                  <p className="mt-2 flex items-start gap-2 break-all text-sm text-[var(--muted)]">
                    <img
                      src="/assets/images/file-text.svg"
                      alt=""
                      aria-hidden="true"
                      className="mt-[2px] h-4 w-4 shrink-0"
                    />
                    <span>{displayPath(prompt.path)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 justify-end gap-2 sm:pt-1">
                  <button
                    type="button"
                    disabled={isLoadingEditor}
                    onClick={(event) => {
                      event.stopPropagation();
                      void openEditDialog(prompt);
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
                      void handleDelete(prompt);
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
        title={editPrompt ? `編集 - ${editPrompt.name}` : "編集"}
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
