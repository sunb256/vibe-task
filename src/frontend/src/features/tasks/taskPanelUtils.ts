import type { TaskRecord, TaskSource } from "./types";

export const TASK_FILTER_ORDER: TaskSource[] = ["action", "pending", "done", "cancel", "runner"];
export const TASK_LIST_FILTER_ORDER: TaskSource[] = ["action", "pending", "done", "cancel"];

const SOURCE_META: Record<
  TaskSource,
  {
    label: string;
    badgeClass: string;
    filterClass: string;
    descending: boolean;
  }
> = {
  action: {
    label: "TODO",
    badgeClass: "bg-blue-100 text-blue-700",
    filterClass: "border-blue-200 bg-blue-100 text-blue-700",
    descending: false,
  },
  runner: {
    label: "RUNNER",
    badgeClass: "bg-orange-100 text-orange-700",
    filterClass: "border-orange-200 bg-orange-100 text-orange-700",
    descending: false,
  },
  pending: {
    label: "PENDING",
    badgeClass: "bg-amber-100 text-amber-700",
    filterClass: "border-amber-200 bg-amber-100 text-amber-700",
    descending: false,
  },
  done: {
    label: "DONE",
    badgeClass: "bg-[#dcf5e3] text-[#3f7651]",
    filterClass: "border-[#bfe7ca] bg-[#dcf5e3] text-[#3f7651]",
    descending: true,
  },
  cancel: {
    label: "CANCEL",
    badgeClass: "bg-zinc-200 text-zinc-700",
    filterClass: "border-zinc-300 bg-zinc-200 text-zinc-700",
    descending: true,
  },
};

export const TASK_STATUS_OPTIONS = TASK_FILTER_ORDER.map((source) => ({
  value: source,
  label: SOURCE_META[source].label,
  toneClass: SOURCE_META[source].filterClass,
}));

export function orderTasks(tasks: TaskRecord[]) {
  return TASK_FILTER_ORDER.flatMap((source) => {
    const sort = SOURCE_META[source].descending ? compareTaskIdDesc : compareTaskIdAsc;
    return tasks.filter((task) => task.source === source).sort(sort);
  });
}

export function filterTasks(tasks: TaskRecord[], visibleSources: Record<TaskSource, boolean>) {
  return tasks.filter((task) => visibleSources[task.source]);
}

export function filterTaskSearch(tasks: TaskRecord[], searchQuery: string) {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return tasks;
  }

  return tasks.filter((task) => {
    const title = showTaskTitle(task.title) ? task.title.toLowerCase() : "";
    return (
      task.id.toLowerCase().includes(query) ||
      sourceLabel(task.source).toLowerCase().includes(query) ||
      title.includes(query) ||
      task.action.toLowerCase().includes(query)
    );
  });
}

export function showTaskTitle(title: string) {
  return title.trim() !== "" && title.trim() !== "-";
}

export function sourceBadgeTone(source: TaskRecord["source"]) {
  return SOURCE_META[source].badgeClass;
}

export function sourceLabel(source: TaskRecord["source"]) {
  return SOURCE_META[source].label;
}

export function sourceFilterClass(source: TaskSource, active: boolean) {
  const tone = SOURCE_META[source].filterClass;
  const inactive = "border-[var(--border)] bg-white text-[var(--muted)]";
  const toneClass = active ? tone : inactive;
  return `inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold uppercase tracking-[0.08em] transition ${toneClass}`;
}

export function countTasks(tasks: TaskRecord[], source: TaskRecord["source"]) {
  return tasks.filter((task) => task.source === source).length;
}

function compareTaskIdDesc(left: TaskRecord, right: TaskRecord) {
  const leftId = Number(left.id);
  const rightId = Number(right.id);
  if (Number.isFinite(leftId) && Number.isFinite(rightId)) {
    return rightId - leftId;
  }
  return right.id.localeCompare(left.id, undefined, { numeric: true, sensitivity: "base" });
}

function compareTaskIdAsc(left: TaskRecord, right: TaskRecord) {
  const leftId = Number(left.id);
  const rightId = Number(right.id);
  if (Number.isFinite(leftId) && Number.isFinite(rightId)) {
    return leftId - rightId;
  }
  return left.id.localeCompare(right.id, undefined, { numeric: true, sensitivity: "base" });
}
