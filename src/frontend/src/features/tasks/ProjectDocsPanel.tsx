import { type ReactNode, useEffect, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

import { Notice } from "../../components/Notice";
import { displayPath } from "../../lib/displayPath";
import { readErrorMessage } from "../../lib/readErrorMessage";
import { ProjectMermaidBlock } from "./ProjectMermaidBlock";
import { fetchProjectDoc, fetchProjectDocs } from "./taskApi";
import type { ProjectDocFile, ProjectDocSummary } from "./types";

type ProjectDocsPanelProps = {
  projectId: string;
  repositoryPath: string;
  isActive: boolean;
};

export function ProjectDocsPanel(props: ProjectDocsPanelProps) {
  const { projectId, repositoryPath, isActive } = props;
  const [docs, setDocs] = useState<ProjectDocSummary[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [currentDoc, setCurrentDoc] = useState<ProjectDocFile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [docError, setDocError] = useState("");
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);

  useEffect(() => {
    if (!isActive || !projectId) {
      return;
    }
    let cancelled = false;
    async function loadDocs() {
      setIsLoadingDocs(true);
      setLoadError("");
      try {
        const response = await fetchProjectDocs(projectId);
        if (cancelled) {
          return;
        }
        setDocs(response.docs);
        setCurrentPath((current) => resolveInitialPath(response.docs, current));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setDocs([]);
        setCurrentPath("");
        setCurrentDoc(null);
        setLoadError(readErrorMessage(error, "Markdown 一覧の取得に失敗しました。"));
      } finally {
        if (!cancelled) {
          setIsLoadingDocs(false);
        }
      }
    }
    void loadDocs();
    return () => {
      cancelled = true;
    };
  }, [isActive, projectId]);

  useEffect(() => {
    if (!isActive || !projectId || !currentPath) {
      return;
    }
    let cancelled = false;
    async function loadDoc() {
      setIsLoadingDoc(true);
      setDocError("");
      try {
        const nextDoc = await fetchProjectDoc(projectId, currentPath);
        if (!cancelled) {
          setCurrentDoc(nextDoc);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setCurrentDoc(null);
        setDocError(readErrorMessage(error, "Markdown の読み込みに失敗しました。"));
      } finally {
        if (!cancelled) {
          setIsLoadingDoc(false);
        }
      }
    }
    void loadDoc();
    return () => {
      cancelled = true;
    };
  }, [currentPath, isActive, projectId]);

  if (!isActive) {
    return null;
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-[0_1px_0_rgba(9,9,11,0.04),0_14px_35px_rgba(9,9,11,0.08)]">
      <div className="mb-4 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--muted)]">
        {displayPath(repositoryPath)}
      </div>
      {loadError ? <Notice tone="error" message={loadError} /> : null}
      {isLoadingDocs ? <Notice tone="neutral" message="Loading docs..." /> : null}
      {!loadError && !isLoadingDocs && docs.length === 0 ? (
        <Notice tone="neutral" message="Markdown は見つかりませんでした。" />
      ) : null}
      {!loadError && !isLoadingDocs && docs.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-[var(--border)] bg-white p-2">
            <ul className="space-y-1">
              {docs.map((doc) => (
                <li key={doc.path}>
                  <button
                    type="button"
                    onClick={() => setCurrentPath(doc.path)}
                    className={docButtonClass(doc.path === currentPath)}
                  >
                    {doc.path}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-h-[18rem] rounded-lg border border-[var(--border)] bg-white px-4 py-3">
            {docError ? <Notice tone="error" message={docError} /> : null}
            {isLoadingDoc ? <Notice tone="neutral" message="Loading markdown..." /> : null}
            {!docError && !isLoadingDoc && currentDoc ? (
              <article className="break-words text-sm leading-7 text-[var(--ink)]">
                <ReactMarkdown components={MARKDOWN_COMPONENTS}>{currentDoc.content}</ReactMarkdown>
              </article>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function resolveInitialPath(docs: ProjectDocSummary[], currentPath: string) {
  if (docs.some((item) => item.path === currentPath)) {
    return currentPath;
  }
  return docs[0]?.path ?? "";
}

function docButtonClass(isActive: boolean) {
  if (isActive) {
    return "w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-left text-xs font-semibold text-blue-700";
  }
  return "w-full rounded-md border border-transparent px-3 py-2 text-left text-xs font-medium text-[var(--ink)] hover:border-[var(--border)] hover:bg-zinc-50";
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => <h1 className="mb-3 mt-1 text-xl font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-3 text-base font-semibold">{children}</h3>,
  p: ({ children }) => <p className="mb-3 whitespace-pre-wrap">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal pl-5">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => renderCodeBlock(className, children),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
    >
      {children}
    </a>
  ),
};

function renderCodeBlock(className: string | undefined, children: ReactNode) {
  const code = codeText(children);
  if (isMermaid(className)) {
    return <ProjectMermaidBlock chart={code} />;
  }
  if (isBlockCode(className, code)) {
    return (
      <pre className="mb-3 overflow-x-auto rounded-md border border-[var(--border)] bg-zinc-50 p-3">
        <code className={className}>{code}</code>
      </pre>
    );
  }
  return <code className="rounded bg-zinc-100 px-1 py-0.5">{code}</code>;
}

function isMermaid(className: string | undefined) {
  return className?.includes("language-mermaid") ?? false;
}

function isBlockCode(className: string | undefined, code: string) {
  if (className && className !== "language-mermaid") {
    return true;
  }
  return code.includes("\n");
}

function codeText(children: ReactNode) {
  const text = Array.isArray(children)
    ? children.map((item) => String(item)).join("")
    : String(children);
  return text.replace(/\n$/, "");
}
