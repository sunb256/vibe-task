import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";

import { ProjectTasksPage } from "./ProjectTasksPage";

vi.mock("../projects/projectApi", () => ({
  fetchProjects: vi.fn(),
}));

vi.mock("./taskApi", () => ({
  createActionTask: vi.fn(),
  deleteTask: vi.fn(),
  fetchTasks: vi.fn(),
}));

import { fetchProjects } from "../projects/projectApi";
import { fetchTasks } from "./taskApi";

afterEach(() => {
  vi.restoreAllMocks();
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
    expect(screen.getByText("Project: impl")).toBeInTheDocument();
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
  const createButton = screen.getByRole("button", { name: "新規タスク" });
  expect(createButton).toBeInTheDocument();
  expect(createButton.parentElement).toHaveClass("justify-start");
  expect(screen.queryByRole("button", { name: "新規" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Project: impl" })).toHaveAttribute(
    "href",
    "/",
  );
  const table = screen.getByRole("table");
  expect(createButton.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "actions" })).toHaveClass("pl-1", "pr-3");
  expect(screen.getByRole("columnheader", { name: "url" })).toHaveClass("text-center");
  expect(screen.getByRole("link", { name: "PR#4" })).toHaveAttribute(
    "href",
    "https://github.com/sunb256/impl/pull/4",
  );
  expect(screen.getByRole("link", { name: "PR#4" })).toHaveClass("rounded-md");
  const editLinks = screen.getAllByRole("link", { name: "編集" });
  expect(editLinks).toHaveLength(3);
  expect(editLinks[0]).toHaveAttribute("href", "/projects/project-1/tasks/action/1/edit");
  expect(editLinks[1]).toHaveAttribute("href", "/projects/project-1/tasks/done/10/edit");
  expect(editLinks[2]).toHaveAttribute("href", "/projects/project-1/tasks/done/2/edit");
  expect(screen.getAllByRole("button", { name: "削除" })).toHaveLength(3);
  expect(editLinks[0]).toHaveClass("w-20");
  expect(editLinks[0].closest("td")).toHaveClass("pl-1", "pr-3");
  expect(screen.getAllByRole("button", { name: "削除" })[0]).toHaveClass("w-20");
  expect(screen.getAllByRole("button", { name: "削除" })[0]).toHaveClass(
    "bg-white",
    "border-rose-200",
    "!text-rose-700",
  );
  expect(screen.getByRole("link", { name: "PR#4" }).closest("td")).toHaveClass("text-center");
  expect(editLinks[0].parentElement).toHaveClass("flex", "items-center");
  expect(editLinks[0].parentElement).not.toHaveClass("flex-wrap");
  const rows = screen.getAllByRole("row");
  expect(within(rows[1]).queryByText("-")).not.toBeInTheDocument();
  expect(within(rows[2]).getByText("done-title-10")).toBeInTheDocument();
  expect(within(rows[3]).getByText("done-title-2")).toBeInTheDocument();
  expect(screen.getByText("first task")).toHaveClass("line-clamp-6");
  expect(screen.getByText("first task")).toHaveClass("max-w-[44rem]");
  expect(within(rows[1]).getByText("1", { selector: "span" })).toBeInTheDocument();
  expect(within(rows[2]).getByText("10", { selector: "span" })).toBeInTheDocument();
});
