import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";

import { ProjectTasksPage } from "./ProjectTasksPage";

vi.mock("../projects/projectApi", () => ({
  fetchProjects: vi.fn(),
}));

vi.mock("./taskApi", () => ({
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
    expect(screen.getByText("impl Tasks")).toBeInTheDocument();
  });
  expect(
    screen.queryByText(
      "action と done の task をまとめて表示します。source 列で所属ファイルを判別できます。",
    ),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Back to TOP" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "impl Tasks" })).toHaveAttribute(
    "href",
    "/",
  );
  expect(screen.getByRole("link", { name: "PR #4" })).toHaveAttribute(
    "href",
    "https://github.com/sunb256/impl/pull/4",
  );
});
