import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Notice } from "../../components/Notice";
import { PageFrame } from "../../components/PageFrame";
import { PrimaryButton } from "../../components/PrimaryButton";
import { fetchTask, updateTaskAction } from "./taskApi";
import type { TaskRecord, TaskSource } from "./types";

export function EditTaskPage() {
  const navigate = useNavigate();
  const { projectId = "", source = "action", taskId = "" } = useParams();
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTask() {
      setIsLoading(true);
      setError("");
      setTask(null);
      setAction("");
      try {
        const response = await fetchTask(projectId, source as TaskSource, taskId);
        if (!cancelled) {
          setTask(response);
          setAction(response.action);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(readError(loadError, "task の取得に失敗しました。"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTask();
    return () => {
      cancelled = true;
    };
  }, [projectId, source, taskId]);

  async function handleSave() {
    setIsSaving(true);
    setError("");
    try {
      await updateTaskAction(projectId, source as TaskSource, taskId, action);
      navigate(`/projects/${projectId}`);
    } catch (saveError) {
      setError(readError(saveError, "task の更新に失敗しました。"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageFrame
      title={`Edit task ${taskId}`}
      subtitle="Monaco Editor では action 本文のみを編集します。その他の項目は参照専用です。"
      actions={
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent)]"
        >
          Back to Project
        </Link>
      }
    >
      <section className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_18px_50px_rgba(31,43,46,0.08)] backdrop-blur">
          {task ? (
            <dl className="grid gap-4 text-sm">
              <MetaRow label="id" value={task.id} />
              <MetaRow label="title" value={task.title} />
              <MetaRow label="url" value={task.url} />
              <MetaRow label="source" value={task.source} />
            </dl>
          ) : null}
          {error ? <Notice tone="error" message={error} /> : null}
          {isLoading ? <Notice tone="neutral" message="Loading task..." /> : null}
        </aside>
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[0_18px_50px_rgba(31,43,46,0.08)] backdrop-blur">
          <Editor
            height="68vh"
            language="markdown"
            value={action}
            onChange={(value) => setAction(value ?? "")}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              wordWrap: "on",
            }}
          />
          <div className="mt-4 flex justify-end">
            <PrimaryButton
              type="button"
              onClick={() => void handleSave()}
              disabled={isLoading || isSaving || !task}
            >
              {isSaving ? "Updating..." : "UPDATE"}
            </PrimaryButton>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

type MetaRowProps = {
  label: string;
  value: string;
};

function MetaRow(props: MetaRowProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        {props.label}
      </dt>
      <dd className="mt-1 break-all text-sm text-[var(--ink)]">{props.value}</dd>
    </div>
  );
}

function readError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
