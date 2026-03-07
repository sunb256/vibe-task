import { useEffect, useState } from "react";

import { Notice } from "../../components/Notice";
import { PrimaryButton } from "../../components/PrimaryButton";
import { TextInput } from "../../components/TextInput";
import { defaultProjectForm, type ProjectFormState } from "./types";

type NewProjectDialogProps = {
  isOpen: boolean;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (form: ProjectFormState) => Promise<void>;
};

export function NewProjectDialog(props: NewProjectDialogProps) {
  const { error, isOpen, isSaving, onClose, onSubmit } = props;
  const [form, setForm] = useState(defaultProjectForm);

  useEffect(() => {
    if (isOpen) {
      setForm(defaultProjectForm);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(form);
  }

  function updateField(field: keyof ProjectFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-950/35 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="w-full max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-[0_24px_80px_rgba(31,43,46,0.18)]"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="new-project-title" className="text-xl font-semibold">
              New Project
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              repositoryPath は実在するリポジトリのディレクトリを指定します。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-3 py-1 text-sm"
          >
            Close
          </button>
        </div>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="name"
              autoFocus
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
            />
            <TextInput
              label="repositoryPath"
              value={form.repositoryPath}
              onChange={(event) =>
                updateField("repositoryPath", event.target.value)
              }
            />
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
          <div className="flex justify-end">
            <PrimaryButton type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Create Project"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
