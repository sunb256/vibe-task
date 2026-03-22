import { useEffect, useId, useState } from "react";

import { Notice } from "../../components/Notice";

const DEFAULT_SCALE = 1;
const MAX_SCALE = 2.5;
const MIN_SCALE = 0.5;
const SCALE_STEP = 0.1;

type MermaidApi = {
  initialize: (config: MermaidConfig) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
};

type MermaidConfig = {
  startOnLoad: false;
  securityLevel: "strict";
};

type ProjectMermaidBlockProps = {
  chart: string;
};

let mermaidApiPromise: Promise<MermaidApi> | null = null;
let mermaidReady = false;

export function ProjectMermaidBlock(props: ProjectMermaidBlockProps) {
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const diagramId = normalizeId(useId());

  useEffect(() => {
    let cancelled = false;
    setScale(DEFAULT_SCALE);
    setError("");
    setSvg("");
    setIsRendering(true);

    async function renderChart() {
      try {
        const mermaid = await loadMermaidApi();
        const rendered = await mermaid.render(`diagram-${diagramId}`, props.chart);
        if (!cancelled) {
          setSvg(rendered.svg);
        }
      } catch {
        if (!cancelled) {
          setError("Mermaid の描画に失敗しました。");
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    }

    void renderChart();
    return () => {
      cancelled = true;
    };
  }, [diagramId, props.chart]);

  if (error) {
    return <Notice tone="error" message={error} />;
  }

  return (
    <div className="mb-3 rounded-md border border-[var(--border)] bg-zinc-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          aria-label="縮小"
          onClick={() => setScale((current) => zoomOut(current))}
          className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-[var(--muted)]"
          disabled={scale <= MIN_SCALE}
        >
          縮小
        </button>
        <button
          type="button"
          aria-label="拡大"
          onClick={() => setScale((current) => zoomIn(current))}
          className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-[var(--muted)]"
          disabled={scale >= MAX_SCALE}
        >
          拡大
        </button>
        <button
          type="button"
          aria-label="リセット"
          onClick={() => setScale(DEFAULT_SCALE)}
          className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-zinc-100"
        >
          リセット
        </button>
        <span className="ml-1 text-xs text-[var(--muted)]">{scale.toFixed(1)}x</span>
      </div>
      <div className="overflow-auto rounded border border-[var(--border)] bg-white p-2">
        {isRendering ? <Notice tone="neutral" message="Rendering mermaid..." /> : null}
        {!isRendering && svg ? (
          <div
            data-testid="mermaid-diagram"
            className="origin-top-left"
            style={{ transform: `scale(${scale})` }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : null}
      </div>
    </div>
  );
}

function normalizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function zoomIn(current: number) {
  return clampScale(current + SCALE_STEP);
}

function zoomOut(current: number) {
  return clampScale(current - SCALE_STEP);
}

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(1))));
}

async function loadMermaidApi() {
  if (!mermaidApiPromise) {
    mermaidApiPromise = import("mermaid").then((module) => module.default as MermaidApi);
  }
  const mermaid = await mermaidApiPromise;
  if (!mermaidReady) {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
    mermaidReady = true;
  }
  return mermaid;
}
