import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, vi } from "vitest";

import { ProjectListPage } from "./ProjectListPage";

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders project cards", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        projects: [
          {
            id: "project-1",
            name: "impl",
            repositoryPath: "/tmp/impl",
            actionListPath: "tasks/action.yml",
            doneListPath: "tasks/done.yml",
          },
        ],
      }),
    ),
  );

  render(
    <MemoryRouter>
      <ProjectListPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("impl")).toBeInTheDocument();
  });
  const taskManagerTitle = screen.getByText("Task Manager");
  expect(taskManagerTitle).toBeInTheDocument();
  expect(taskManagerTitle).toHaveClass("text-[11px]", "text-sky-700/80");
  const pageTitle = screen.getByRole("heading", { level: 1, name: "Project 一覧" });
  expect(pageTitle).toBeInTheDocument();
  expect(pageTitle).toHaveClass("text-xl");
  expect(screen.getByRole("link", { name: "Project 一覧" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("button", { name: "新規プロジェクト" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Setting" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "NEW" })).not.toBeInTheDocument();
  expect(
    screen.queryByText(
      "ローカルリポジトリと task YAML を紐づけて、一覧表示と action 編集を行います。",
    ),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /impl/ })).toHaveAttribute(
    "href",
    "/projects/project-1",
  );
  expect(screen.queryByRole("link", { name: "Open Project" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "新規プロジェクト" }));
  expect(screen.getByRole("dialog", { name: "新規作成" })).toBeInTheDocument();
  expect(
    screen.queryByText("repositoryPath は実在するリポジトリのディレクトリを指定します。"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "プロジェクト作成" })).toBeInTheDocument();
  const cancelButton = screen.getByRole("button", { name: "Cancel" });
  expect(cancelButton).toHaveClass("px-4", "py-2");
  const createDialogOverlay = screen.getByRole("dialog", { name: "新規作成" }).parentElement;
  expect(createDialogOverlay).not.toBeNull();
  if (!createDialogOverlay) {
    throw new Error("create dialog overlay is missing");
  }
  fireEvent.mouseDown(createDialogOverlay);
  expect(screen.queryByRole("dialog", { name: "新規作成" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Setting" }));
  expect(screen.getByRole("dialog", { name: "Setting" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "projects.yml をエクスポート" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "インポート" })).toBeDisabled();
  const settingsCancelButton = screen.getByRole("button", { name: "Cancel" });
  expect(settingsCancelButton).toHaveClass("px-4", "py-2");
  const settingsDialogOverlay = screen.getByRole("dialog", { name: "Setting" }).parentElement;
  expect(settingsDialogOverlay).not.toBeNull();
  if (!settingsDialogOverlay) {
    throw new Error("settings dialog overlay is missing");
  }
  fireEvent.mouseDown(settingsDialogOverlay);
  expect(screen.queryByRole("dialog", { name: "Setting" })).not.toBeInTheDocument();
});
