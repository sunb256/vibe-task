import Editor from "@monaco-editor/react";
import { type FormEvent, type MouseEvent, useEffect, useRef } from "react";

import { Notice } from "../../components/Notice";

type NewTaskDialogProps = {
  isOpen: boolean;
  isSaving: boolean;
  error: string;
  action: string;
  title: string;
  titleIconSrc?: string;
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
    titleIconSrc,
    description,
    submitLabel,
    submittingLabel,
    enableShortcut,
    onActionChange,
    onClose,
    onSubmit,
  } = props;
  const isSavingRef = useRef(isSaving);
  const onCloseRef = useRef(onClose);
  const onSubmitRef = useRef(onSubmit);
  const submitLockRef = useRef(false);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  async function triggerSubmit() {
    if (isSavingRef.current || submitLockRef.current) {
      return;
    }
    submitLockRef.current = true;
    try {
      await onSubmitRef.current();
    } finally {
      submitLockRef.current = false;
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (!isSavingRef.current) {
          onCloseRef.current();
        }
        return;
      }
      if (!enableShortcut || !isSaveShortcut(event) || isSavingRef.current) {
        return;
      }
      event.preventDefault();
      void triggerSubmit();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enableShortcut, isOpen]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await triggerSubmit();
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-dialog-title"
        className="w-full max-w-6xl rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-[0_1px_0_rgba(9,9,11,0.06),0_24px_70px_rgba(9,9,11,0.28)]"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="task-dialog-title" className="flex items-center gap-2 text-xl font-semibold">
              {titleIconSrc ? (
                <img
                  src={titleIconSrc}
                  alt=""
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-[var(--muted)]"
                />
              ) : null}
              <span>{title}</span>
            </h2>
            {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
          </div>
        </div>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="mt-1 overflow-hidden rounded-md border border-[var(--border)] bg-white">
            <Editor
              height="52vh"
              language="markdown"
              value={action}
              onChange={(value) => onActionChange(value ?? "")}
              onMount={(editor, monaco) => {
                editor.updateOptions({
                  editContext: false,
                  selectionHighlight: false,
                  occurrencesHighlight: "off",
                  renderLineHighlight: "none",
                  wordSegmenterLocales: ["ja"],
                  wordSeparators:
                    "~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?、。，．・：；？！…（）［］｛｝「」『』【】〈〉《》〔〕",
                });
                editor.focus();
                if (!enableShortcut) {
                  return;
                }
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                  void triggerSubmit();
                });
                editor.addCommand(monaco.KeyCode.Escape, () => {
                  if (!isSavingRef.current) {
                    onCloseRef.current();
                  }
                });
              }}
              options={{
                fontSize: 15,
                minimap: { enabled: false },
                wordWrap: "on",
                padding: { top: 18 },
                renderLineHighlight: "none",
                editContext: false,
              }}
            />
          </div>
          {error ? <Notice tone="error" message={error} /> : null}
          <div className="flex justify-end gap-2">
            <button type="submit" disabled={isSaving} className={dialogSubmitButtonClass()}>
              {isSaving ? submittingLabel : submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={dialogCancelButtonClass()}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function isSaveShortcut(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && event.key === "Enter";
}

function dialogSubmitButtonClass() {
  return "inline-flex h-10 min-w-[4.5rem] items-center justify-center whitespace-nowrap rounded-md bg-[var(--accent)] px-4 text-sm font-medium tracking-tight text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] transition hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60";
}

function dialogCancelButtonClass() {
  return "inline-flex h-10 min-w-[4.5rem] items-center justify-center whitespace-nowrap rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60";
}
