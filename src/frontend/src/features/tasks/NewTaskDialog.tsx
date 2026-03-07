import Editor from "@monaco-editor/react";
import { type FormEvent, useEffect } from "react";

import { Notice } from "../../components/Notice";
import { PrimaryButton } from "../../components/PrimaryButton";

type NewTaskDialogProps = {
  isOpen: boolean;
  isSaving: boolean;
  error: string;
  action: string;
  title: string;
  description: string;
  submitLabel: string;
  submittingLabel: string;
  enableShortcut?: boolean;
  onActionChange: (action: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
};

export function NewTaskDialog(props: NewTaskDialogProps) {
  const {
    isOpen,
    isSaving,
    error,
    action,
    title,
    description,
    submitLabel,
    submittingLabel,
    enableShortcut,
    onActionChange,
    onClose,
    onSubmit,
  } = props;

  useEffect(() => {
    if (!isOpen || !enableShortcut) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (!isSaving) {
          onClose();
        }
        return;
      }
      if (!isSaveShortcut(event) || isSaving) {
        return;
      }
      event.preventDefault();
      void onSubmit();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enableShortcut, isOpen, isSaving, onClose, onSubmit]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit();
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-dialog-title"
        className="w-full max-w-4xl rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-[0_1px_0_rgba(9,9,11,0.06),0_24px_70px_rgba(9,9,11,0.28)]"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="task-dialog-title" className="text-xl font-semibold">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1 text-sm text-[var(--muted)] transition hover:text-[var(--ink)]"
          >
            Close
          </button>
        </div>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <Editor
            height="40vh"
            language="markdown"
            value={action}
            onChange={(value) => onActionChange(value ?? "")}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              wordWrap: "on",
            }}
          />
          {error ? <Notice tone="error" message={error} /> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50"
            >
              Cancel
            </button>
            <PrimaryButton type="submit" disabled={isSaving}>
              {isSaving ? submittingLabel : submitLabel}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function isSaveShortcut(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && event.key === "Enter";
}
