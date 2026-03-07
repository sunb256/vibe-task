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
        title: "done-title",
        url: "-",
        action: "done task",
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
    "id/source",
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
  const createButton = screen.getByRole("button", { name: "新規" });
  expect(createButton).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "impl" })).toHaveAttribute(
    "href",
    "/",
  );
  const table = screen.getByRole("table");
  expect(createButton.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole("link", { name: "PR#4" })).toHaveAttribute(
    "href",
    "https://github.com/sunb256/impl/pull/4",
  );
  expect(screen.getByRole("link", { name: "PR#4" })).toHaveClass("rounded-md");
  const editLinks = screen.getAllByRole("link", { name: "編集" });
  expect(editLinks).toHaveLength(2);
  expect(editLinks[0]).toHaveAttribute("href", "/projects/project-1/tasks/action/1/edit");
  expect(editLinks[1]).toHaveAttribute("href", "/projects/project-1/tasks/done/2/edit");
  expect(screen.getAllByRole("button", { name: "削除" })).toHaveLength(2);
  expect(editLinks[0]).toHaveClass("w-20");
  expect(screen.getAllByRole("button", { name: "削除" })[0]).toHaveClass("w-20");
  const rows = screen.getAllByRole("row");
  expect(within(rows[1]).queryByText("-")).not.toBeInTheDocument();
  expect(within(rows[2]).getByText("done-title")).toBeInTheDocument();
  expect(screen.getByText("TODO(1)", { selector: "span" })).toHaveClass(
    "bg-amber-100",
    "text-amber-700",
  );
  expect(screen.getByText("DONE(2)", { selector: "span" })).toHaveClass(
    "bg-emerald-100",
    "text-emerald-700",
  );
});
