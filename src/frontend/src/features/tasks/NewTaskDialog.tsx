import Editor from "@monaco-editor/react";
import { type FormEvent, type MouseEvent, useEffect, useRef } from "react";

import { Notice } from "../../components/Notice";

type DialogStatusOption = {
  value: string;
  label: string;
  toneClass?: string;
};

type DialogCopyOption = {
  value: string;
  label: string;
};

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
  statusLabel?: string;
  statusValue?: string;
  statusOptions?: DialogStatusOption[];
  copySourceLabel?: string;
  copySourceValue?: string;
  copySourceOptions?: DialogCopyOption[];
  copyLabel?: string;
  onActionChange: (action: string) => void;
  onStatusChange?: (status: string) => void;
  onCopySourceChange?: (source: string) => void;
  onCopy?: () => Promise<void>;
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
    statusLabel,
    statusValue,
    statusOptions,
    copySourceLabel,
    copySourceValue,
    copySourceOptions,
    copyLabel,
    onActionChange,
    onStatusChange,
    onCopySourceChange,
    onCopy,
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
        className="w-full max-w-7xl rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-6 py-8 shadow-[0_1px_0_rgba(9,9,11,0.06),0_24px_70px_rgba(9,9,11,0.28)]"
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
              height="64vh"
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
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {statusOptions && statusValue !== undefined && onStatusChange ? (
                <fieldset className="flex flex-wrap items-center gap-2 border-0 p-0">
                  <legend className="sr-only">{statusLabel ?? "状態"}</legend>
                  <span className="text-sm font-semibold text-[var(--ink)]">
                    {statusLabel ?? "状態"}
                  </span>
                  {statusOptions.map((option) => {
                    const checked = option.value === statusValue;
                    return (
                      <label
                        key={option.value}
                        className={`${statusOptionClass(option, checked)} ${isSaving ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                      >
                        <input
                          type="radio"
                          name="task-status"
                          value={option.value}
                          checked={checked}
                          onChange={() => onStatusChange(option.value)}
                          disabled={isSaving}
                          className="sr-only"
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </fieldset>
              ) : null}
              {copySourceOptions && copySourceValue !== undefined && onCopySourceChange && onCopy ? (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="task-copy-source"
                    className="text-sm font-semibold text-[var(--ink)]"
                  >
                    {copySourceLabel ?? "コピー元"}
                  </label>
                  <select
                    id="task-copy-source"
                    aria-label={`${copySourceLabel ?? "コピー元"}タスク`}
                    value={copySourceValue}
                    onChange={(event) => onCopySourceChange(event.target.value)}
                    disabled={isSaving || copySourceOptions.length === 0}
                    className="h-10 min-w-[17rem] rounded-md border border-[var(--border)] bg-white px-3 text-sm text-[var(--ink)] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">選択してください</option>
                    {copySourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      void onCopy();
                    }}
                    disabled={isSaving || copySourceOptions.length === 0}
                    className={dialogCancelButtonClass()}
                  >
                    {copyLabel ?? "コピー"}
                  </button>
                </div>
              ) : null}
            </div>
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
          </div>
        </form>
      </div>
    </div>
  );
}

function statusOptionClass(option: DialogStatusOption, checked: boolean) {
  const base =
    "inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold transition focus-within:ring-2 focus-within:ring-[var(--accent)]/20";
  if (!checked) {
    return `${base} border-[var(--border)] bg-white text-[var(--ink)] hover:border-[var(--ink)]`;
  }
  if (!option.toneClass) {
    return `${base} border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]`;
  }
  return `${base} ${option.toneClass}`;
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
