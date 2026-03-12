import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, vi } from "vitest";

import { ProjectTasksPage } from "./ProjectTasksPage";
import { resetProjectTasksPageCacheForTest } from "./projectTasksPageCache";

vi.mock("@monaco-editor/react", () => ({
  default: (props: {
    value?: string;
    onChange?: (value: string) => void;
    onMount?: (
      editor: {
        focus: () => void;
        addCommand: () => number;
        updateOptions: (options: unknown) => void;
      },
      monaco: unknown,
    ) => void;
    options?: { editContext?: boolean };
  }) => (
    <textarea
      aria-label="task-editor"
      data-edit-context={String(props.options?.editContext)}
      value={props.value ?? ""}
      ref={(node) => {
        if (!node || !props.onMount) {
          return;
        }
        props.onMount(
          {
            focus: () => node.focus(),
            addCommand: () => 0,
            updateOptions: () => {},
          },
          {
            KeyMod: { CtrlCmd: 1 },
            KeyCode: { Enter: 1, Escape: 2 },
          },
        );
      }}
      onChange={(event) => props.onChange?.(event.target.value)}
    />
  ),
}));

vi.mock("../projects/projectApi", () => ({
  fetchProjects: vi.fn(),
}));

vi.mock("./taskApi", () => ({
  createActionTask: vi.fn(),
  deleteTask: vi.fn(),
  fetchTasks: vi.fn(),
  swapTaskId: vi.fn(),
  updateTask: vi.fn(),
}));

import { fetchProjects } from "../projects/projectApi";
import { createActionTask, fetchTasks, swapTaskId, updateTask } from "./taskApi";

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ headerBand: "zinc" })),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  resetProjectTasksPageCacheForTest();
});

test("does not render the removed project subtitle", async () => {
  vi.mocked(fetchProjects).mockResolvedValue({
    projects: [
      {
        id: "project-1",
        name: "impl",
        repositoryPath: "/tmp/impl",
      },
    ],
  });
  vi.mocked(fetchTasks).mockResolvedValue({
    tasks: [
      {
        projectId: "project-1",
        source: "action",
        id: "1",
        title: "-",
        url: "https://github.com/sunb256/impl/pull/4",
        action: "first task",
      },
      {
        projectId: "project-1",
        source: "done",
        id: "2",
        title: "done-title-2",
        url: "-",
        action: "done task 2",
      },
      {
        projectId: "project-1",
        source: "done",
        id: "10",
        title: "done-title-10",
        url: "-",
        action: "done task 10",
      },
    ],
  });

  render(
    <MemoryRouter initialEntries={["/projects/project-1"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectTasksPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("impl")).toBeInTheDocument();
  });
  expect(screen.getByRole("link", { name: "Project" })).toHaveAttribute("href", "/");
  expect(
    screen
      .getByRole("link", { name: "Project" })
      .querySelector('img[src="/assets/images/vibe_task_logo_active.png"]'),
  ).not.toBeNull();
  expect(screen.getByRole("link", { name: "Custom Prompt" })).toHaveAttribute(
    "href",
    "/custom-prompt",
  );
  expect(screen.getByRole("link", { name: "Skills" })).toHaveAttribute("href", "/skills");
  expect(screen.getByRole("button", { name: "Setting" })).toBeInTheDocument();
  expect(screen.queryByText("VIBE TASK")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "impl" })).toBeInTheDocument();
  expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
    "id",
    "task",
    "actions",
    "url",
  ]);
  expect(
    screen.queryByText(
      "action と done の task をまとめて表示します。source 列で所属ファイルを判別できます。",
    ),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Back to TOP" })).not.toBeInTheDocument();
  const createButton = screen.getByRole("button", { name: "新規タスク(N)" });
  expect(createButton).toBeInTheDocument();
  expect(createButton.closest("div")).toHaveClass("justify-start", "pl-2");
  expect(screen.queryByRole("button", { name: "新規" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "impl" })).not.toBeInTheDocument();
  const table = screen.getByRole("table");
  expect(table).toHaveClass("border-spacing-y-1");
  expect(createButton.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const todoToggle = screen.getByRole("button", { name: "TODO(1)" });
  const pendingToggle = screen.getByRole("button", { name: "PENDING(0)" });
  const doneToggle = screen.getByRole("button", { name: "DONE(2)" });
  const cancelToggle = screen.getByRole("button", { name: "CANCEL(0)" });
  expect(todoToggle).toHaveAttribute("aria-pressed", "true");
  expect(pendingToggle).toHaveAttribute("aria-pressed", "true");
  expect(doneToggle).toHaveAttribute("aria-pressed", "false");
  expect(cancelToggle).toHaveAttribute("aria-pressed", "false");
  expect(todoToggle).toHaveClass("bg-blue-100", "text-blue-700", "rounded-full");
  expect(pendingToggle).toHaveClass("bg-amber-100", "text-amber-700", "rounded-full");
  expect(doneToggle).toHaveClass("rounded-full");
  expect(cancelToggle).toHaveClass("rounded-full");
  expect(screen.getByRole("columnheader", { name: "id" })).toHaveClass("whitespace-nowrap");
  expect(screen.getByRole("columnheader", { name: "task" })).toHaveClass("w-full");
  expect(screen.getByRole("columnheader", { name: "actions" })).toHaveClass("pl-1", "pr-3");
  expect(screen.getByRole("columnheader", { name: "actions" })).toHaveClass("w-[13rem]");
  expect(screen.getByRole("columnheader", { name: "url" })).toHaveClass("text-center");
  expect(screen.getByRole("link", { name: "PR#4" })).toHaveAttribute(
    "href",
    "https://github.com/sunb256/impl/pull/4",
  );
  expect(screen.getByRole("link", { name: "PR#4" })).toHaveClass("rounded-md");
  const editButtons = screen.getAllByRole("button", { name: "編集" });
  expect(editButtons).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "削除" })).toHaveLength(1);
  expect(editButtons[0]).toHaveClass("w-[4.5rem]");
  expect(editButtons[0].closest("td")).toHaveClass("pl-1", "pr-3");
  expect(screen.getAllByRole("button", { name: "削除" })[0]).toHaveClass("w-[4.5rem]");
  expect(screen.getAllByRole("button", { name: "削除" })[0]).toHaveClass(
    "bg-white",
    "border-rose-200",
    "!text-rose-700",
  );
  expect(screen.getByRole("link", { name: "PR#4" }).closest("td")).toHaveClass("text-center");
  expect(editButtons[0].parentElement).toHaveClass("flex", "items-center");
  expect(editButtons[0].parentElement).not.toHaveClass("flex-wrap");
  expect(screen.getByRole("button", { name: "task 1 を上へ" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "task 1 を下へ" })).toBeDisabled();
  const rows = screen.getAllByRole("row");
  expect(rows).toHaveLength(2);
  expect(rows[1].querySelector("td")).toHaveClass("py-2", "whitespace-nowrap");
  expect(rows[1].querySelector("td")).toHaveClass("group-hover:bg-amber-50/70");
  expect(within(rows[1]).queryByText("-")).not.toBeInTheDocument();
  expect(screen.queryByText("done-title-10")).not.toBeInTheDocument();
  expect(screen.queryByText("done-title-2")).not.toBeInTheDocument();
  expect(screen.getByText("first task")).toHaveClass("line-clamp-6");
  expect(screen.getByText("first task")).toHaveClass("max-w-[56rem]");
  expect(screen.getByText("first task")).toHaveClass("break-all");
  expect(screen.getByText("first task")).toHaveClass("text-black");
  fireEvent.click(screen.getByText("TODO #1", { selector: "span" }));
  expect(screen.getByRole("dialog", { name: "編集 - #1" })).toBeInTheDocument();
  const editDialog = screen.getByRole("dialog", { name: "編集 - #1" });
  expect(editDialog.querySelector('img[src="/assets/images/square-check-big.svg"]')).not.toBeNull();
  expect(editDialog).toHaveClass("max-w-7xl");
  expect(screen.getByRole("button", { name: "更新" })).toHaveClass(
    "min-w-[4.5rem]",
    "whitespace-nowrap",
    "bg-[var(--accent)]",
    "text-white",
  );
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass(
    "min-w-[4.5rem]",
    "whitespace-nowrap",
  );
  expect(screen.getByLabelText("状態")).toHaveValue("action");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "編集 - #1" })).not.toBeInTheDocument();
  const taskCellButton = screen.getByRole("button", { name: "task 1 を編集" });
  expect(taskCellButton).toHaveClass("text-left");
  fireEvent.click(taskCellButton);
  expect(screen.getByRole("dialog", { name: "編集 - #1" })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "編集 - #1" })).not.toBeInTheDocument();
  expect(screen.getByText("TODO #1", { selector: "span" })).toHaveClass(
    "bg-blue-100",
    "text-blue-700",
  );
  expect(screen.queryByText("DONE #10", { selector: "span" })).not.toBeInTheDocument();

  fireEvent.click(doneToggle);

  await waitFor(() => {
    expect(screen.getAllByRole("button", { name: "編集" })).toHaveLength(3);
  });
  expect(doneToggle).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("done-title-10")).toBeInTheDocument();
  expect(screen.getByText("done-title-2")).toBeInTheDocument();
  expect(screen.getByText("DONE #10", { selector: "span" })).toHaveClass(
    "bg-[#e3eee6]",
    "text-[#557060]",
  );
});

test("swaps task ids with up/down buttons", async () => {
  vi.mocked(fetchProjects).mockResolvedValue({
    projects: [
      {
        id: "project-1",
        name: "impl",
        repositoryPath: "/tmp/impl",
      },
    ],
  });
  vi.mocked(fetchTasks)
    .mockResolvedValueOnce({
      tasks: [
        {
          projectId: "project-1",
          source: "action",
          id: "1",
          title: "-",
          url: "-",
          action: "first task",
        },
        {
          projectId: "project-1",
          source: "action",
          id: "2",
          title: "-",
          url: "-",
          action: "second task",
        },
      ],
    })
    .mockResolvedValueOnce({
      tasks: [
        {
          projectId: "project-1",
          source: "action",
          id: "2",
          title: "-",
          url: "-",
          action: "first task",
        },
        {
          projectId: "project-1",
          source: "action",
          id: "1",
          title: "-",
          url: "-",
          action: "second task",
        },
      ],
    });
  vi.mocked(swapTaskId).mockResolvedValue();

  render(
    <MemoryRouter initialEntries={["/projects/project-1"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectTasksPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("impl")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "task 1 を下へ" }));

  await waitFor(() => {
    expect(swapTaskId).toHaveBeenCalledWith("project-1", "action", "1", "2");
    expect(fetchTasks).toHaveBeenCalledTimes(2);
  });
  expect(screen.getByText("TODO #2", { selector: "span" })).toBeInTheDocument();
  const movedUpRow = screen.getByText("second task").closest("tr");
  const movedDownRow = screen.getByText("first task").closest("tr");
  if (!movedUpRow || !movedDownRow) {
    throw new Error("swapped rows are missing");
  }
  expect(
    movedUpRow.compareDocumentPosition(movedDownRow) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test("renders tasks before project list request finishes", async () => {
  vi.mocked(fetchProjects).mockImplementation(() => new Promise(() => {}));
  vi.mocked(fetchTasks).mockResolvedValue({
    tasks: [
      {
        projectId: "project-1",
        source: "action",
        id: "1",
        title: "-",
        url: "-",
        action: "fast task",
      },
    ],
  });

  render(
    <MemoryRouter initialEntries={["/projects/project-1"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectTasksPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("fast task")).toBeInTheDocument();
  });
  expect(screen.queryByText("Loading tasks...")).not.toBeInTheDocument();
  expect(
    screen
      .getAllByRole("link", { name: "Project" })
      .some((link) => link.getAttribute("href") === "/"),
  ).toBe(true);
  expect(screen.getByRole("link", { name: "Custom Prompt" })).toHaveAttribute(
    "href",
    "/custom-prompt",
  );
  expect(screen.getByRole("link", { name: "Skills" })).toHaveAttribute("href", "/skills");
});

test("uses cached tasks on revisit before refetch resolves", async () => {
  vi.mocked(fetchProjects).mockResolvedValue({
    projects: [
      {
        id: "project-1",
        name: "impl",
        repositoryPath: "/tmp/impl",
      },
    ],
  });
  vi.mocked(fetchTasks).mockResolvedValue({
    tasks: [
      {
        projectId: "project-1",
        source: "action",
        id: "1",
        title: "-",
        url: "-",
        action: "cached task",
      },
    ],
  });

  const first = render(
    <MemoryRouter initialEntries={["/projects/project-1"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectTasksPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(screen.getByText("cached task")).toBeInTheDocument();
  });
  first.unmount();

  vi.mocked(fetchProjects).mockImplementation(() => new Promise(() => {}));
  vi.mocked(fetchTasks).mockImplementation(() => new Promise(() => {}));

  render(
    <MemoryRouter initialEntries={["/projects/project-1"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectTasksPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByText("cached task")).toBeInTheDocument();
  expect(screen.queryByText("Loading tasks...")).not.toBeInTheDocument();
});

test("creates a new action task from modal editor", async () => {
  vi.mocked(fetchProjects).mockResolvedValue({
    projects: [
      {
        id: "project-1",
        name: "impl",
        repositoryPath: "/tmp/impl",
      },
    ],
  });
  vi.mocked(fetchTasks)
    .mockResolvedValueOnce({
      tasks: [
        {
          projectId: "project-1",
          source: "action",
          id: "1",
          title: "-",
          url: "-",
          action: "first task",
        },
      ],
    })
    .mockResolvedValueOnce({
      tasks: [
        {
          projectId: "project-1",
          source: "action",
          id: "1",
          title: "-",
          url: "-",
          action: "first task",
        },
        {
          projectId: "project-1",
          source: "action",
          id: "2",
          title: "-",
          url: "-",
          action: "newly created task",
        },
      ],
    });
  vi.mocked(createActionTask).mockResolvedValue({
    projectId: "project-1",
    source: "action",
    id: "2",
    title: "-",
    url: "-",
    action: "TODO\n",
  });
  vi.mocked(updateTask).mockResolvedValue({
    projectId: "project-1",
    source: "action",
    id: "2",
    title: "-",
    url: "-",
    action: "newly created task\n",
  });

  render(
    <MemoryRouter initialEntries={["/projects/project-1"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectTasksPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("impl")).toBeInTheDocument();
  });

  fireEvent.keyDown(window, { key: "n", ctrlKey: true });
  expect(screen.getByRole("dialog", { name: "新規タスク" })).toBeInTheDocument();
  const createDialog = screen.getByRole("dialog", { name: "新規タスク" });
  expect(createDialog.querySelector('img[src="/assets/images/square-check-big.svg"]')).not.toBeNull();
  expect(createDialog).toHaveClass("max-w-7xl");
  expect(screen.getByLabelText("task-editor")).toHaveFocus();
  expect(screen.getByRole("button", { name: "新規作成" })).toHaveClass(
    "min-w-[4.5rem]",
    "whitespace-nowrap",
    "bg-[var(--accent)]",
    "text-white",
  );
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass(
    "min-w-[4.5rem]",
    "whitespace-nowrap",
  );
  expect(screen.getByLabelText("task-editor")).toHaveValue("");
  expect(screen.getByLabelText("task-editor")).toHaveAttribute("data-edit-context", "false");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "新規タスク" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "新規タスク(N)" })).toHaveFocus();

  fireEvent.keyDown(window, { key: "n", altKey: true });
  expect(screen.getByRole("dialog", { name: "新規タスク" })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "新規タスク" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "新規タスク(N)" })).toHaveFocus();

  fireEvent.click(screen.getByRole("button", { name: "新規タスク(N)" }));
  expect(screen.getByRole("dialog", { name: "新規タスク" })).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("dialog", { name: "新規タスク" }).parentElement!);
  expect(screen.queryByRole("dialog", { name: "新規タスク" })).not.toBeInTheDocument();
  expect(createActionTask).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "新規タスク(N)" }));
  expect(screen.getByRole("dialog", { name: "新規タスク" })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "新規タスク" })).not.toBeInTheDocument();
  expect(createActionTask).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "新規タスク(N)" }));
  expect(screen.getByRole("dialog", { name: "新規タスク" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("task-editor"), {
    target: { value: "newly created task" },
  });
  fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });

  await waitFor(() => {
    expect(createActionTask).toHaveBeenCalledWith("project-1");
    expect(updateTask).toHaveBeenCalledWith(
      "project-1",
      "action",
      "2",
      "newly created task",
    );
    expect(screen.getByText("newly created task")).toBeInTheDocument();
  });
  expect(screen.queryByRole("dialog", { name: "新規タスク" })).not.toBeInTheDocument();
});

test("edits a task in modal editor and supports keyboard shortcuts", async () => {
  vi.mocked(fetchProjects).mockResolvedValue({
    projects: [
      {
        id: "project-1",
        name: "impl",
        repositoryPath: "/tmp/impl",
      },
    ],
  });
  vi.mocked(fetchTasks)
    .mockResolvedValueOnce({
      tasks: [
        {
          projectId: "project-1",
          source: "action",
          id: "1",
          title: "-",
          url: "-",
          action: "first task",
        },
      ],
    })
    .mockResolvedValueOnce({
      tasks: [
        {
          projectId: "project-1",
          source: "pending",
          id: "1",
          title: "-",
          url: "-",
          action: "edited task",
        },
      ],
    });
  vi.mocked(updateTask).mockResolvedValue({
    projectId: "project-1",
    source: "pending",
    id: "1",
    title: "-",
    url: "-",
    action: "edited task",
  });

  render(
    <MemoryRouter initialEntries={["/projects/project-1"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectTasksPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("impl")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "編集" }));
  expect(screen.getByRole("dialog", { name: "編集 - #1" })).toBeInTheDocument();
  expect(screen.getByLabelText("task-editor")).toHaveFocus();
  fireEvent.change(screen.getByLabelText("状態"), {
    target: { value: "pending" },
  });
  fireEvent.change(screen.getByLabelText("task-editor"), {
    target: { value: "edited task" },
  });
  fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });

  await waitFor(() => {
    expect(updateTask).toHaveBeenCalledWith("project-1", "action", "1", "edited task", "pending");
    expect(screen.getByText("edited task")).toBeInTheDocument();
  });
  expect(screen.queryByRole("dialog", { name: "編集 - #1" })).not.toBeInTheDocument();
  expect(screen.getByText("PENDING #1", { selector: "span" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "編集" }));
  expect(screen.getByRole("dialog", { name: "編集 - #1" })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "編集 - #1" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "新規タスク(N)" })).toHaveFocus();
  expect(updateTask).toHaveBeenCalledTimes(1);
});

test("shows empty-state message when no task exists", async () => {
  vi.mocked(fetchProjects).mockResolvedValue({
    projects: [
      {
        id: "project-1",
        name: "impl",
        repositoryPath: "/tmp/impl",
      },
    ],
  });
  vi.mocked(fetchTasks).mockResolvedValue({ tasks: [] });

  render(
    <MemoryRouter initialEntries={["/projects/project-1"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectTasksPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("task はありません")).toBeInTheDocument();
  });
  expect(screen.queryByText("task は見つかりませんでした。")).not.toBeInTheDocument();
});
