import {
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type SetStateAction,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useId,
  useState,
} from "react";

import { Notice } from "../../components/Notice";

const DEFAULT_SCALE = 1;
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

type MermaidView = {
  scale: number;
  x: number;
  y: number;
};

type DragState = {
  active: boolean;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type ProjectMermaidBlockProps = {
  chart: string;
};

type MermaidModalProps = {
  svg: string;
  view: MermaidView;
  dragState: DragState;
  panEnabled: boolean;
  onClose: () => void;
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onTogglePan: () => void;
  onWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  onDragStart: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onDragMove: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onDragStop: () => void;
};

const DEFAULT_VIEW: MermaidView = { scale: DEFAULT_SCALE, x: 0, y: 0 };
const DEFAULT_DRAG: DragState = {
  active: false,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
};

let mermaidApiPromise: Promise<MermaidApi> | null = null;
let mermaidReady = false;

export function ProjectMermaidBlock(props: ProjectMermaidBlockProps) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [panEnabled, setPanEnabled] = useState(true);
  const [view, setView] = useState<MermaidView>(DEFAULT_VIEW);
  const [dragState, setDragState] = useState<DragState>(DEFAULT_DRAG);
  const diagramId = normalizeId(useId());

  useEffect(() => {
    let cancelled = false;
    resetModalState(setView, setDragState, setPanEnabled);
    setError("");
    setSvg("");
    setIsRendering(true);
    void renderMermaid(props.chart, diagramId, () => cancelled, setSvg, setError, setIsRendering);
    return () => {
      cancelled = true;
    };
  }, [diagramId, props.chart]);

  useEffect(() => {
    if (!dragState.active) {
      return;
    }
    const handleMouseUp = () => setDragState((current) => ({ ...current, active: false }));
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState.active]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (error) {
    return <Notice tone="error" message={error} />;
  }

  function openModal() {
    resetModalState(setView, setDragState, setPanEnabled);
    setIsOpen(true);
  }

  return (
    <div className="mb-3 rounded-md border border-[var(--border)] bg-zinc-50 p-3">
      {isRendering ? <Notice tone="neutral" message="Rendering mermaid..." /> : null}
      {!isRendering && svg ? (
        <button
          type="button"
          onClick={openModal}
          aria-label="Mermaidを拡大表示"
          className="block w-full overflow-hidden rounded border border-[var(--border)] bg-white p-2 text-left hover:border-sky-300"
        >
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">クリックで拡大表示</p>
          <div
            data-testid="mermaid-preview-diagram"
            className="max-h-[22rem] origin-top-left overflow-hidden"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </button>
      ) : null}
      {isOpen ? (
        <MermaidModal
          svg={svg}
          view={view}
          dragState={dragState}
          panEnabled={panEnabled}
          onClose={() => setIsOpen(false)}
          onReset={() => resetView(setView, setDragState)}
          onZoomIn={() => setView((current) => ({ ...current, scale: zoomIn(current.scale) }))}
          onZoomOut={() => setView((current) => ({ ...current, scale: zoomOut(current.scale) }))}
          onTogglePan={() => setPanEnabled((current) => !current)}
          onWheel={(event) => handleWheelZoom(event, setView)}
          onDragStart={(event) => startDrag(event, panEnabled, view, setDragState)}
          onDragMove={(event) => moveDrag(event, dragState, setView)}
          onDragStop={() => setDragState((current) => ({ ...current, active: false }))}
        />
      ) : null}
    </div>
  );
}

function MermaidModal(props: MermaidModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mermaid preview"
      className="fixed inset-0 z-50 bg-white/90 backdrop-blur-[1px]"
      onClick={props.onClose}
    >
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div
          className="relative flex h-full w-full max-h-[94vh] max-w-[1200px] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-white/95 px-2 py-1 text-xs font-semibold text-[var(--muted)] shadow">
            {props.view.scale.toFixed(1)}x
          </div>
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded bg-white/95 p-1 shadow">
            <IconButton
              label="ドラッグ"
              active={props.panEnabled}
              onClick={props.onTogglePan}
              icon={<DragIcon />}
            />
            <IconButton label="拡大" onClick={props.onZoomIn} icon={<ZoomInIcon />} />
            <IconButton label="縮小" onClick={props.onZoomOut} icon={<ZoomOutIcon />} />
            <IconButton label="リセット" onClick={props.onReset} icon={<ResetIcon />} />
            <IconButton label="閉じる" onClick={props.onClose} icon={<CloseIcon />} />
          </div>
          <div
            data-testid="mermaid-modal-canvas"
            className={modalCanvasClass(props.panEnabled, props.dragState.active)}
            onWheel={props.onWheel}
            onMouseDown={props.onDragStart}
            onMouseMove={props.onDragMove}
            onMouseUp={props.onDragStop}
            onMouseLeave={props.onDragStop}
          >
            <div
              data-testid="mermaid-modal-diagram"
              className="w-full origin-center [&_svg]:h-auto [&_svg]:max-w-none [&_svg]:w-full"
              style={{
                transform: `translate(${props.view.x}px, ${props.view.y}px) scale(${props.view.scale})`,
              }}
              dangerouslySetInnerHTML={{ __html: props.svg }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type IconButtonProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
};

function IconButton(props: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={props.label}
      onClick={props.onClick}
      className={iconButtonClass(Boolean(props.active))}
    >
      {props.icon}
    </button>
  );
}

function modalCanvasClass(panEnabled: boolean, isDragging: boolean) {
  if (!panEnabled) {
    return "relative flex flex-1 items-start justify-center overflow-hidden bg-white px-4 pb-4 pt-14";
  }
  if (isDragging) {
    return "relative flex flex-1 cursor-grabbing items-start justify-center overflow-hidden bg-white px-4 pb-4 pt-14";
  }
  return "relative flex flex-1 cursor-grab items-start justify-center overflow-hidden bg-white px-4 pb-4 pt-14";
}

function iconButtonClass(active: boolean) {
  if (active) {
    return "rounded border border-sky-300 bg-sky-50 p-1.5 text-sky-700 hover:bg-sky-100";
  }
  return "rounded border border-[var(--border)] bg-white p-1.5 text-[var(--ink)] hover:bg-zinc-100";
}

function startDrag(
  event: ReactMouseEvent<HTMLDivElement>,
  panEnabled: boolean,
  view: MermaidView,
  setDragState: Dispatch<SetStateAction<DragState>>,
) {
  if (!panEnabled) {
    return;
  }
  event.preventDefault();
  setDragState({
    active: true,
    startX: event.clientX,
    startY: event.clientY,
    originX: view.x,
    originY: view.y,
  });
}

function moveDrag(
  event: ReactMouseEvent<HTMLDivElement>,
  dragState: DragState,
  setView: Dispatch<SetStateAction<MermaidView>>,
) {
  if (!dragState.active) {
    return;
  }
  event.preventDefault();
  const nextX = dragState.originX + (event.clientX - dragState.startX);
  const nextY = dragState.originY + (event.clientY - dragState.startY);
  setView((current) => ({ ...current, x: nextX, y: nextY }));
}

function handleWheelZoom(
  event: ReactWheelEvent<HTMLDivElement>,
  setView: Dispatch<SetStateAction<MermaidView>>,
) {
  event.preventDefault();
  const delta = event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
  setView((current) => ({ ...current, scale: clampScale(current.scale + delta) }));
}

function resetView(
  setView: Dispatch<SetStateAction<MermaidView>>,
  setDragState: Dispatch<SetStateAction<DragState>>,
) {
  setView(DEFAULT_VIEW);
  setDragState(DEFAULT_DRAG);
}

function resetModalState(
  setView: Dispatch<SetStateAction<MermaidView>>,
  setDragState: Dispatch<SetStateAction<DragState>>,
  setPanEnabled: Dispatch<SetStateAction<boolean>>,
) {
  setView(DEFAULT_VIEW);
  setDragState(DEFAULT_DRAG);
  setPanEnabled(true);
}

async function renderMermaid(
  chart: string,
  diagramId: string,
  isCancelled: () => boolean,
  setSvg: Dispatch<SetStateAction<string>>,
  setError: Dispatch<SetStateAction<string>>,
  setIsRendering: Dispatch<SetStateAction<boolean>>,
) {
  try {
    const mermaid = await loadMermaidApi();
    const rendered = await mermaid.render(`diagram-${diagramId}`, chart);
    if (!isCancelled()) {
      setSvg(rendered.svg);
    }
  } catch {
    if (!isCancelled()) {
      setError("Mermaid の描画に失敗しました。");
    }
  } finally {
    if (!isCancelled()) {
      setIsRendering(false);
    }
  }
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
  return Math.max(MIN_SCALE, Number(value.toFixed(1)));
}

function DragIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 2v16M2 10h16M5.5 5.5L2 2M14.5 5.5L18 2M5.5 14.5L2 18M14.5 14.5L18 18" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M8.5 6v5M6 8.5h5M13 13l4 4" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M6 8.5h5M13 13l4 4" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 10a6 6 0 1 1-1.8-4.3" />
      <path d="M16 4v4h-4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
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
