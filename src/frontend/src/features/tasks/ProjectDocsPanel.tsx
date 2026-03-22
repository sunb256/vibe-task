import { type ReactNode, useEffect, useMemo, useState } from "react";
import hljs from "highlight.js/lib/common";
import ReactMarkdown, { type Components } from "react-markdown";

import { Notice } from "../../components/Notice";
import { readErrorMessage } from "../../lib/readErrorMessage";
import { ProjectMermaidBlock } from "./ProjectMermaidBlock";
import { type FrontMatterRow, splitFrontMatter } from "./frontMatter";
import { fetchProjectDoc, fetchProjectDocs } from "./taskApi";
import type { ProjectDocFile, ProjectDocSummary } from "./types";

type ProjectDocsPanelProps = {
  projectId: string;
  isActive: boolean;
};

export function ProjectDocsPanel(props: ProjectDocsPanelProps) {
  const { projectId, isActive } = props;
  const [docs, setDocs] = useState<ProjectDocSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPath, setCurrentPath] = useState("");
  const [currentDoc, setCurrentDoc] = useState<ProjectDocFile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [docError, setDocError] = useState("");
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const visibleDocs = useMemo(() => filterDocs(docs, searchQuery), [docs, searchQuery]);
  const parsedDoc = useMemo(() => splitFrontMatter(currentDoc?.content ?? ""), [currentDoc?.content]);

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

  useEffect(() => {
    if (!isActive) {
      return;
    }
    setCurrentPath((current) => resolveInitialPath(visibleDocs, current));
  }, [isActive, visibleDocs]);

  if (!isActive) {
    return null;
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-[0_1px_0_rgba(9,9,11,0.04),0_14px_35px_rgba(9,9,11,0.08)]">
      <div className="mb-4 flex justify-start">
        <div className="relative w-full max-w-56">
          <img
            src="/assets/images/search.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-65"
          />
          <input
            id="project-doc-search"
            type="search"
            aria-label="Search"
            autoFocus
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/12"
          />
        </div>
      </div>
      {loadError ? <Notice tone="error" message={loadError} /> : null}
      {isLoadingDocs ? <Notice tone="neutral" message="Loading docs..." /> : null}
      {!loadError && !isLoadingDocs && docs.length === 0 ? (
        <Notice tone="neutral" message="Markdown は見つかりませんでした。" />
      ) : null}
      {!loadError && !isLoadingDocs && docs.length > 0 && visibleDocs.length === 0 ? (
        <Notice tone="neutral" message="検索条件に一致するMarkdownはありません。" />
      ) : null}
      {!loadError && !isLoadingDocs && visibleDocs.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-[var(--border)] bg-white p-2">
            <ul className="space-y-1">
              {visibleDocs.map((doc) => (
                <li key={doc.path}>
                  <button
                    type="button"
                    onClick={() => setCurrentPath(doc.path)}
                    className={docButtonClass(doc.path === currentPath)}
                  >
                    {docMenuLabel(doc.path)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-h-[18rem] rounded-lg border border-[var(--border)] bg-white px-4 py-3">
            {docError ? <Notice tone="error" message={docError} /> : null}
            {isLoadingDoc ? <Notice tone="neutral" message="Loading markdown..." /> : null}
            {!docError && !isLoadingDoc && currentDoc && currentPath ? (
              <article className="break-words text-sm leading-7 text-[var(--ink)]">
                {parsedDoc.rows.length > 0 ? <FrontMatterTable rows={parsedDoc.rows} /> : null}
                <ReactMarkdown components={MARKDOWN_COMPONENTS}>{parsedDoc.body}</ReactMarkdown>
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

function filterDocs(docs: ProjectDocSummary[], queryText: string) {
  const query = queryText.trim().toLowerCase();
  if (!query) {
    return docs;
  }
  return docs.filter((doc) => doc.path.toLowerCase().includes(query));
}

function docButtonClass(isActive: boolean) {
  if (isActive) {
    return "w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-left text-xs font-semibold text-blue-700";
  }
  return "w-full rounded-md border border-transparent px-3 py-2 text-left text-xs font-medium text-[var(--ink)] hover:border-[var(--border)] hover:bg-zinc-50";
}

function docMenuLabel(path: string) {
  return path.replace(/\.md$/i, "");
}

type FrontMatterTableProps = {
  rows: FrontMatterRow[];
};

function FrontMatterTable(props: FrontMatterTableProps) {
  return (
    <div className="mb-4 overflow-x-auto rounded-md border border-[var(--border)] bg-zinc-50/70">
      <table aria-label="Front matter" className="min-w-full border-collapse text-left text-xs">
        <thead className="bg-zinc-100 text-[var(--muted)]">
          <tr>
            <th className="w-40 border-b border-[var(--border)] px-3 py-2 font-semibold">Key</th>
            <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">Value</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, index) => (
            <tr key={`${row.key}-${index}`}>
              <th className="border-b border-[var(--border)] px-3 py-2 align-top font-semibold text-[var(--ink)]">
                {row.key}
              </th>
              <td className="border-b border-[var(--border)] px-3 py-2 text-[var(--ink)]">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => <h1 className="mb-3 mt-1 text-xl font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-3 text-base font-semibold">{children}</h3>,
  p: ({ children }) => <p className="mb-3 whitespace-pre-wrap">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal pl-5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
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
    const lang = parseLang(className);
    const html = highlightCode(code, lang);
    return (
      <pre className="mb-3 overflow-x-auto rounded-md border border-[var(--border)] bg-zinc-50 p-3">
        <code
          className={highlightClass(lang)}
          data-testid="markdown-code-block"
          dangerouslySetInnerHTML={{ __html: html }}
        />
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

function parseLang(className: string | undefined) {
  const matched = /language-([a-z0-9_-]+)/i.exec(className ?? "");
  return matched?.[1] ?? "";
}

function highlightClass(lang: string) {
  return lang ? `hljs language-${lang}` : "hljs";
}

function highlightCode(code: string, lang: string) {
  if (lang && hljs.getLanguage(lang)) {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  }
  return hljs.highlightAuto(code).value;
}

function codeText(children: ReactNode) {
  const text = Array.isArray(children)
    ? children.map((item) => String(item)).join("")
    : String(children);
  return text.replace(/\n$/, "");
}
