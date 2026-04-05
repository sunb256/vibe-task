import { type RefObject } from "react";

import { ListStateNotice } from "../../components/ListStateNotice";
import { Notice } from "../../components/Notice";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { ProjectDocsPanel } from "./ProjectDocsPanel";
import {
  TASK_LIST_FILTER_ORDER,
  countTasks,
  showTaskTitle,
  sourceBadgeTone,
  sourceFilterClass,
  sourceLabel,
} from "./taskPanelUtils";
import type { RunnerHistoryRecord, TaskRecord, TaskSource } from "./types";

export type RunnerTab = "list" | "log" | "history";

type TaskTabPanelProps = {
  tasks: TaskRecord[];
  orderedTasks: TaskRecord[];
  visibleTasks: TaskRecord[];
  filteredTasks: TaskRecord[];
  visibleSources: Record<TaskSource, boolean>;
  taskSearchQuery: string;
  isCreating: boolean;
  isLoading: boolean;
  isSwapping: boolean;
  error: string;
  createButtonRef: RefObject<HTMLButtonElement | null>;
  onTaskSearchChange: (value: string) => void;
  onToggleSource: (source: TaskSource) => void;
  onOpenCreateDialog: () => void;
  onEdit: (task: TaskRecord) => void;
  onCopy: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => void;
  onSwap: (task: TaskRecord, targetId: string | null) => void;
};

export function TaskTabPanel(props: TaskTabPanelProps) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-[0_1px_0_rgba(9,9,11,0.04),0_14px_35px_rgba(9,9,11,0.08)]">
      <div className="mb-4 flex w-full items-center justify-start gap-2 pl-2">
        <PrimaryButton
          ref={props.createButtonRef}
          type="button"
          onClick={props.onOpenCreateDialog}
          disabled={props.isCreating}
        >
          新規タスク(N)
        </PrimaryButton>
        {TASK_LIST_FILTER_ORDER.map((source, index) => (
          <button
            key={source}
            type="button"
            aria-pressed={props.visibleSources[source]}
            onClick={() => props.onToggleSource(source)}
            className={`${sourceFilterClass(source, props.visibleSources[source])} ${index === 0 ? "ml-2" : ""}`}
          >
            {`${sourceLabel(source)}(${countTasks(props.tasks, source)})`}
          </button>
        ))}
        <SearchInput
          id="task-search"
          value={props.taskSearchQuery}
          onChange={props.onTaskSearchChange}
          wrapperClassName="w-full min-w-48 max-w-64"
        />
      </div>
      <ListStateNotice
        error={props.error}
        isLoading={props.isLoading}
        hasItems={props.visibleTasks.length > 0}
        hasVisibleItems={props.filteredTasks.length > 0}
        loadingMessage="Loading tasks..."
        emptyMessage="task はありません"
        noMatchMessage="検索条件に一致するtask はありません。"
      />
      {!props.isLoading && props.filteredTasks.length > 0 ? (
        <TaskTable
          tasks={props.filteredTasks}
          orderedTasks={props.orderedTasks}
          isSwapping={props.isSwapping}
          onEdit={props.onEdit}
          onCopy={props.onCopy}
          onDelete={props.onDelete}
          onSwap={props.onSwap}
        />
      ) : null}
    </section>
  );
}

type RunnerTabPanelProps = {
  activeRunnerTab: RunnerTab;
  setActiveRunnerTab: (tab: RunnerTab) => void;
  error: string;
  isLoading: boolean;
  isCreating: boolean;
  isRunnerStarting: boolean;
  isRunnerCanceling: boolean;
  isRunnerRunning: boolean;
  isSwapping: boolean;
  orderedTasks: TaskRecord[];
  runnerTasks: TaskRecord[];
  runnerLog: string;
  runnerLogError: string;
  runnerHistory: RunnerHistoryRecord[];
  onOpenCreateRunnerDialog: () => void;
  onRunnerAction: () => void;
  onEdit: (task: TaskRecord) => void;
  onCopy: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => void;
  onSwap: (task: TaskRecord, targetId: string | null) => void;
};

export function RunnerTabPanel(props: RunnerTabPanelProps) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-[0_1px_0_rgba(9,9,11,0.04),0_14px_35px_rgba(9,9,11,0.08)]">
      <div className="mb-4 flex w-full items-center justify-start gap-2 pl-2">
        <PrimaryButton type="button" onClick={props.onOpenCreateRunnerDialog} disabled={props.isCreating}>
          新規Runner
        </PrimaryButton>
        <PrimaryButton
          type="button"
          onClick={props.onRunnerAction}
          disabled={props.isRunnerStarting || props.isRunnerCanceling}
        >
          {props.isRunnerStarting
            ? "起動中..."
            : props.isRunnerCanceling
              ? "キャンセル中..."
              : props.isRunnerRunning
                ? "Runnerキャンセル"
                : "Runner実行"}
        </PrimaryButton>
        <button
          type="button"
          onClick={() => props.setActiveRunnerTab("list")}
          className={runnerTabClass(props.activeRunnerTab === "list")}
        >
          Runner
        </button>
        <button
          type="button"
          onClick={() => props.setActiveRunnerTab("log")}
          className={runnerTabClass(props.activeRunnerTab === "log")}
        >
          ログ
        </button>
        <button
          type="button"
          onClick={() => props.setActiveRunnerTab("history")}
          className={runnerTabClass(props.activeRunnerTab === "history")}
        >
          履歴
        </button>
      </div>
      {props.error ? <Notice tone="error" message={props.error} /> : null}
      {props.isLoading ? <Notice tone="neutral" message="Loading tasks..." /> : null}
      {props.activeRunnerTab === "list" && !props.error && !props.isLoading && props.runnerTasks.length === 0 ? (
        <Notice tone="neutral" message="RUNNER task はありません" />
      ) : null}
      {props.activeRunnerTab === "list" && !props.error && !props.isLoading && props.runnerTasks.length > 0 ? (
        <TaskTable
          tasks={props.runnerTasks}
          orderedTasks={props.orderedTasks}
          isSwapping={props.isSwapping}
          onEdit={props.onEdit}
          onCopy={props.onCopy}
          onDelete={props.onDelete}
          onSwap={props.onSwap}
        />
      ) : null}
      {props.activeRunnerTab === "log" ? (
        <RunnerLogPanel
          runnerLog={props.runnerLog}
          isRunning={props.isRunnerRunning}
          logError={props.runnerLogError}
        />
      ) : null}
      {props.activeRunnerTab === "history" ? <RunnerHistoryPanel history={props.runnerHistory} /> : null}
    </section>
  );
}

type DocsTabPanelProps = {
  projectId: string;
};

export function DocsTabPanel(props: DocsTabPanelProps) {
  return <ProjectDocsPanel isActive projectId={props.projectId} />;
}

function sourceTag(task: TaskRecord) {
  return `${sourceLabel(task.source)} #${task.id}`;
}

type TaskPrLinkProps = {
  url: string;
};

function TaskPrLink(props: TaskPrLinkProps) {
  if (props.url === "-") {
    return <span className="block max-w-[14rem] break-all">-</span>;
  }

  return (
    <a
      href={props.url}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        event.stopPropagation();
      }}
      className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50"
    >
      {prLabel(props.url)}
    </a>
  );
}

function prLabel(url: string) {
  const matched = /\/pull\/(\d+)$/.exec(url);
  if (!matched) {
    return "PR";
  }
  return `PR#${matched[1]}`;
}

type TaskTableProps = {
  tasks: TaskRecord[];
  orderedTasks: TaskRecord[];
  isSwapping: boolean;
  onEdit: (task: TaskRecord) => void;
  onCopy: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => void;
  onSwap: (task: TaskRecord, targetId: string | null) => void;
};

function TaskTable(props: TaskTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-y-1 text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <th className="px-3 whitespace-nowrap">id</th>
            <th className="px-3 w-full">task</th>
            <th className="pl-1 pr-3 w-[18rem] whitespace-nowrap">actions</th>
            <th className="px-3 text-center">url</th>
          </tr>
        </thead>
        <tbody>
          {props.tasks.map((task) => {
            const upTargetId = swapTargetId(props.orderedTasks, task, "up");
            const downTargetId = swapTargetId(props.orderedTasks, task, "down");
            return (
              <tr
                key={`${task.source}-${task.id}`}
                onClick={(event) => {
                  if (hasTextSelection(event.currentTarget)) {
                    return;
                  }
                  props.onEdit(task);
                }}
                className="group cursor-pointer"
              >
                <td className="rounded-l-md border-y border-l border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-[var(--muted)] whitespace-nowrap transition group-hover:bg-amber-50/70 group-focus-within:bg-amber-50/70">
                  <span
                    className={`rounded-md px-3 py-1 text-xs font-semibold uppercase ${sourceBadgeTone(task.source)}`}
                  >
                    {sourceTag(task)}
                  </span>
                </td>
                <td className="w-full min-w-[34rem] border-y border-[var(--border)] bg-[var(--panel-strong)] transition group-hover:bg-amber-50/70 group-focus-within:bg-amber-50/70">
                  <button
                    type="button"
                    aria-label={`task ${task.id} を編集`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (hasTextSelection(event.currentTarget)) {
                        return;
                      }
                      props.onEdit(task);
                    }}
                    className="block h-full w-full select-text px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    <div className="space-y-1">
                      {showTaskTitle(task.title) ? (
                        <p className="select-text font-semibold text-[var(--ink)]">{task.title}</p>
                      ) : null}
                      <p className="line-clamp-6 max-w-[56rem] whitespace-pre-wrap break-all select-text text-black">
                        {task.action}
                      </p>
                    </div>
                  </button>
                </td>
                <td className="w-[18rem] whitespace-nowrap border-y border-[var(--border)] bg-[var(--panel-strong)] pl-1 pr-3 py-2 transition group-hover:bg-amber-50/70 group-focus-within:bg-amber-50/70">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onEdit(task);
                      }}
                      className="inline-flex w-[4.5rem] items-center justify-center rounded-md border border-[var(--border)] bg-white px-3 py-2 font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onCopy(task);
                      }}
                      className="inline-flex w-[4.5rem] items-center justify-center rounded-md border border-[var(--border)] bg-white px-3 py-2 font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50"
                    >
                      コピー
                    </button>
                    <PrimaryButton
                      type="button"
                      className="w-[4.5rem] border border-rose-200 bg-white !text-rose-700 hover:border-rose-300 hover:bg-rose-50 focus-visible:outline-rose-300"
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onDelete(task);
                      }}
                    >
                      削除
                    </PrimaryButton>
                    <SwapButton
                      label="↑"
                      ariaLabel={`task ${task.id} を上へ`}
                      disabled={props.isSwapping || !upTargetId}
                      onClick={() => props.onSwap(task, upTargetId)}
                    />
                    <SwapButton
                      label="↓"
                      ariaLabel={`task ${task.id} を下へ`}
                      disabled={props.isSwapping || !downTargetId}
                      onClick={() => props.onSwap(task, downTargetId)}
                    />
                  </div>
                </td>
                <td className="rounded-r-md border-y border-r border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-center transition group-hover:bg-amber-50/70 group-focus-within:bg-amber-50/70">
                  <TaskPrLink url={task.url} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type RunnerHistoryPanelProps = {
  history: RunnerHistoryRecord[];
};

function RunnerHistoryPanel(props: RunnerHistoryPanelProps) {
  const history = [...props.history].reverse();
  return (
    <section className="mb-4 rounded-lg border border-[var(--border)] bg-white px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--ink)]">RUNNER履歴</h2>
        <span className="text-xs text-[var(--muted)]">{history.length}件</span>
      </div>
      {history.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">履歴はありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="text-[var(--muted)]">
                <th className="px-2 py-1 font-medium">id</th>
                <th className="px-2 py-1 font-medium">datetime</th>
                <th className="px-2 py-1 font-medium">status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, index) => (
                <tr key={`${item.datetime}-${index}`} className="border-t border-[var(--border)]">
                  <td className="px-2 py-1 text-[var(--ink)]">{item.id.join(", ")}</td>
                  <td className="px-2 py-1 text-[var(--ink)]">{item.datetime}</td>
                  <td className="px-2 py-1">
                    <span className={runnerStatusClass(item.status)}>{item.status.toUpperCase()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type RunnerLogPanelProps = {
  runnerLog: string;
  isRunning: boolean;
  logError: string;
};

function RunnerLogPanel(props: RunnerLogPanelProps) {
  return (
    <section className="flex h-[calc(100vh-16rem)] min-h-[28rem] flex-col rounded-lg border border-[var(--border)] bg-white px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--ink)]">ログ</h2>
        <span className={runnerStateClass(props.isRunning)}>{props.isRunning ? "RUNNING" : "IDLE"}</span>
      </div>
      {props.logError ? <Notice tone="error" message={props.logError} /> : null}
      <pre className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--border)] bg-zinc-950 px-3 py-2 text-xs leading-5 text-zinc-100">
        {props.runnerLog || "ログはありません。"}
      </pre>
    </section>
  );
}

function runnerTabClass(isActive: boolean) {
  if (isActive) {
    return "inline-flex h-8 items-center rounded-full border border-zinc-300 bg-zinc-200 px-3 text-xs font-semibold";
  }
  return "inline-flex h-8 items-center rounded-full border border-[var(--border)] bg-white px-3 text-xs font-semibold text-[var(--muted)]";
}

function runnerStateClass(isRunning: boolean) {
  if (isRunning) {
    return "inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700";
  }
  return "inline-flex rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700";
}

function runnerStatusClass(status: RunnerHistoryRecord["status"]) {
  if (status === "error") {
    return "inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700";
  }
  return "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700";
}

function swapTargetId(
  tasks: TaskRecord[],
  task: TaskRecord,
  direction: "up" | "down",
) {
  const sourceTasks = tasks.filter((item) => item.source === task.source);
  const index = sourceTasks.findIndex((item) => item.id === task.id);
  if (index < 0) {
    return null;
  }
  const offset = direction === "up" ? -1 : 1;
  const target = sourceTasks[index + offset];
  return target ? target.id : null;
}

type SwapButtonProps = {
  label: string;
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
};

function SwapButton(props: SwapButtonProps) {
  const { label, ariaLabel, disabled, onClick } = props;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-white text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-[var(--muted)]"
    >
      {label}
    </button>
  );
}

function hasTextSelection(container: Node) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }
  const selectedText = selection.toString().trim();
  if (selectedText.length === 0) {
    return false;
  }
  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  return (
    (anchorNode ? container.contains(anchorNode) : false) ||
    (focusNode ? container.contains(focusNode) : false)
  );
}
