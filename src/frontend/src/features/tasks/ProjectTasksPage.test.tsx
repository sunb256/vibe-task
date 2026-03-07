import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";

import { ProjectTasksPage } from "./ProjectTasksPage";
import { resetProjectTasksPageCacheForTest } from "./projectTasksPageCache";

vi.mock("@monaco-editor/react", () => ({
  default: (props: {
    value?: string;
    onChange?: (value: string) => void;
    onMount?: (editor: { focus: () => void; addCommand: () => number }, monaco: unknown) => void;
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
  updateTaskAction: vi.fn(),
}));

import { fetchProjects } from "../projects/projectApi";
import { createActionTask, fetchTasks, swapTaskId, updateTaskAction } from "./taskApi";

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
        actionListPath: "tasks/action.yml",
        doneListPath: "tasks/done.yml",
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
  expect(createButton.parentElement).toHaveClass("justify-start", "pl-2");
  expect(screen.queryByRole("button", { name: "新規" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "impl" })).toHaveAttribute(
    "href",
    "/",
  );
  const table = screen.getByRole("table");
  expect(table).toHaveClass("border-spacing-y-2");
  expect(createButton.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const todoToggle = screen.getByRole("button", { name: "TODO(1)" });
  const doneToggle = screen.getByRole("button", { name: "DONE(2)" });
  expect(todoToggle).toHaveAttribute("aria-pressed", "true");
  expect(doneToggle).toHaveAttribute("aria-pressed", "false");
  expect(todoToggle).toHaveClass("bg-blue-100", "text-blue-700", "rounded-full");
  expect(doneToggle).toHaveClass("rounded-full");
  expect(screen.getByRole("columnheader", { name: "id" })).toHaveClass("whitespace-nowrap");
  expect(screen.getByRole("columnheader", { name: "actions" })).toHaveClass("pl-1", "pr-3");
  expect(screen.getByRole("columnheader", { name: "url" })).toHaveClass("text-center");
  expect(screen.getByRole("link", { name: "PR#4" })).toHaveAttribute(
    "href",
    "https://github.com/sunb256/impl/pull/4",
  );
  expect(screen.getByRole("link", { name: "PR#4" })).toHaveClass("rounded-md");
  const editButtons = screen.getAllByRole("button", { name: "編集" });
  expect(editButtons).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "削除" })).toHaveLength(1);
  expect(editButtons[0]).toHaveClass("w-20");
  expect(editButtons[0].closest("td")).toHaveClass("pl-1", "pr-3");
  expect(screen.getAllByRole("button", { name: "削除" })[0]).toHaveClass("w-20");
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
  expect(rows[1].querySelector("td")).toHaveClass("py-3", "whitespace-nowrap");
  expect(within(rows[1]).queryByText("-")).not.toBeInTheDocument();
  expect(screen.queryByText("done-title-10")).not.toBeInTheDocument();
  expect(screen.queryByText("done-title-2")).not.toBeInTheDocument();
  expect(screen.getByText("first task")).toHaveClass("line-clamp-6");
  expect(screen.getByText("first task")).toHaveClass("max-w-[44rem]");
  expect(screen.getByText("first task")).toHaveClass("break-all");
  expect(screen.getByText("first task")).toHaveClass("text-black");
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
    "bg-emerald-100",
    "text-emerald-700",
  );
});

test("swaps task ids with up/down buttons", async () => {
  vi.mocked(fetchProjects).mockResolvedValue({
    projects: [
      {
        id: "project-1",
        name: "impl",
        repositoryPath: "/tmp/impl",
        actionListPath: "tasks/action.yml",
        doneListPath: "tasks/done.yml",
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
  expect(screen.getByRole("link", { name: "Project" })).toHaveAttribute("href", "/");
});

test("uses cached tasks on revisit before refetch resolves", async () => {
  vi.mocked(fetchProjects).mockResolvedValue({
    projects: [
      {
        id: "project-1",
        name: "impl",
        repositoryPath: "/tmp/impl",
        actionListPath: "tasks/action.yml",
        doneListPath: "tasks/done.yml",
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
        actionListPath: "tasks/action.yml",
        doneListPath: "tasks/done.yml",
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
  vi.mocked(updateTaskAction).mockResolvedValue({
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
  expect(screen.getByLabelText("task-editor")).toHaveFocus();
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
    expect(updateTaskAction).toHaveBeenCalledWith(
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
        actionListPath: "tasks/action.yml",
        doneListPath: "tasks/done.yml",
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
          action: "edited task",
        },
      ],
    });
  vi.mocked(updateTaskAction).mockResolvedValue({
    projectId: "project-1",
    source: "action",
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
  fireEvent.change(screen.getByLabelText("task-editor"), {
    target: { value: "edited task" },
  });
  fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });

  await waitFor(() => {
    expect(updateTaskAction).toHaveBeenCalledWith("project-1", "action", "1", "edited task");
    expect(screen.getByText("edited task")).toBeInTheDocument();
  });
  expect(screen.queryByRole("dialog", { name: "編集 - #1" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "編集" }));
  expect(screen.getByRole("dialog", { name: "編集 - #1" })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "編集 - #1" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "新規タスク(N)" })).toHaveFocus();
  expect(updateTaskAction).toHaveBeenCalledTimes(1);
});
