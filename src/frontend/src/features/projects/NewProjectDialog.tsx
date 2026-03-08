import { type MouseEvent, useEffect, useState } from "react";

import { Notice } from "../../components/Notice";
import { PrimaryButton } from "../../components/PrimaryButton";
import { TextInput } from "../../components/TextInput";
import { defaultProjectForm, type ProjectFormState } from "./types";

type NewProjectDialogProps = {
  isOpen: boolean;
  isSaving: boolean;
  error: string;
  title: string;
  autoFillNameFromRepositoryPath?: boolean;
  submitLabel: string;
  submittingLabel: string;
  initialForm?: ProjectFormState;
  onClose: () => void;
  onSubmit: (form: ProjectFormState) => Promise<void>;
};

export function NewProjectDialog(props: NewProjectDialogProps) {
  const {
    error,
    isOpen,
    isSaving,
    title,
    autoFillNameFromRepositoryPath = false,
    submitLabel,
    submittingLabel,
    initialForm,
    onClose,
    onSubmit,
  } = props;
  const [form, setForm] = useState(defaultProjectForm);

  useEffect(() => {
    if (isOpen) {
      setForm(initialForm ?? defaultProjectForm);
    }
  }, [initialForm, isOpen]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(form);
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }
    onClose();
  }

  function updateField(field: keyof ProjectFormState, value: string) {
    setForm((current) => buildNextForm(current, field, value, autoFillNameFromRepositoryPath));
  }

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-[0_1px_0_rgba(9,9,11,0.06),0_24px_70px_rgba(9,9,11,0.28)]"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="new-project-title" className="text-xl font-semibold">
              {title}
            </h2>
          </div>
        </div>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <TextInput
                label="repositoryPath"
                autoFocus
                value={form.repositoryPath}
                onChange={(event) =>
                  updateField("repositoryPath", event.target.value)
                }
              />
            </div>
            <div>
              <TextInput
                label="name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="action-list path"
              value={form.actionListPath}
              onChange={(event) =>
                updateField("actionListPath", event.target.value)
              }
            />
            <TextInput
              label="done-list path"
              value={form.doneListPath}
              onChange={(event) => updateField("doneListPath", event.target.value)}
            />
          </div>
          {error ? <Notice tone="error" message={error} /> : null}
          <div className="flex justify-end gap-2">
            <PrimaryButton type="submit" disabled={isSaving}>
              {isSaving ? submittingLabel : submitLabel}
            </PrimaryButton>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function buildNextForm(
  current: ProjectFormState,
  field: keyof ProjectFormState,
  value: string,
  autoFillNameFromRepositoryPath: boolean,
) {
  const next = { ...current, [field]: value };
  if (!shouldAutoFillName(field, current, autoFillNameFromRepositoryPath)) {
    return next;
  }
  const detectedName = detectRepositoryName(value);
  if (detectedName) {
    next.name = detectedName;
  }
  return next;
}

function shouldAutoFillName(
  field: keyof ProjectFormState,
  current: ProjectFormState,
  autoFillNameFromRepositoryPath: boolean,
) {
  if (!autoFillNameFromRepositoryPath) {
    return false;
  }
  if (field !== "repositoryPath") {
    return false;
  }
  return current.name.trim() === "";
}

function detectRepositoryName(repositoryPath: string) {
  const normalized = repositoryPath.trim().replace(/[\\/]+$/, "");
  if (!normalized) {
    return "";
  }
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  if (parts.length === 0) {
    return "";
  }
  return parts[parts.length - 1];
}
