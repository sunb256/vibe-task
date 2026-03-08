import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";

import { ProjectListPage } from "./ProjectListPage";

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders project list", async () => {
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
  const taskManagerTitle = screen.getByText("VIBE TASK");
  expect(taskManagerTitle).toBeInTheDocument();
  expect(taskManagerTitle).toHaveClass("text-[12px]", "text-sky-700/80");
  const pageTitle = screen.getByRole("heading", { level: 1, name: "Project 一覧" });
  expect(pageTitle).toBeInTheDocument();
  expect(pageTitle).toHaveClass("text-xl");
  expect(screen.getByRole("link", { name: "Project 一覧" })).toHaveAttribute("href", "/");
  const pageTitleLink = screen.getByRole("link", { name: "Project 一覧" });
  expect(pageTitleLink.querySelector('img[src="/assets/images/logs.svg"]')).not.toBeNull();
  expect(screen.getByRole("button", { name: "新規プロジェクト" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Setting" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "NEW" })).not.toBeInTheDocument();
  expect(
    screen.queryByText(
      "ローカルリポジトリと task YAML を紐づけて、一覧表示と action 編集を行います。",
    ),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "impl を開く" })).toHaveAttribute("tabindex", "0");
  expect(screen.queryByText("action-list")).not.toBeInTheDocument();
  expect(screen.queryByText("done-list")).not.toBeInTheDocument();
  const projectCard = screen.getByText("impl").closest("article");
  const projectList = projectCard?.parentElement;
  expect(projectCard?.querySelector('img[src="/assets/images/code-xml.svg"]')).not.toBeNull();
  expect(projectCard?.querySelector('img[src="/assets/images/git-branch.svg"]')).not.toBeNull();
  expect(projectCard).toHaveClass("px-4", "py-3");
  expect(projectList).toHaveClass("space-y-3");
  expect(projectList).not.toHaveClass("md:grid-cols-2");
  expect(screen.queryByRole("link", { name: "Open Project" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "新規プロジェクト" }));
  expect(screen.getByRole("dialog", { name: "新規作成" })).toBeInTheDocument();
  expect(
    screen.queryByText("repositoryPath は実在するリポジトリのディレクトリを指定します。"),
  ).not.toBeInTheDocument();
  const repositoryPathInput = screen.getByLabelText("repositoryPath");
  expect(repositoryPathInput.parentElement?.parentElement).not.toHaveClass("md:grid-cols-2");
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

  fireEvent.click(screen.getByRole("button", { name: "編集" }));
  expect(screen.getByRole("dialog", { name: "プロジェクト編集 - #project-1" })).toBeInTheDocument();
  expect(screen.getByDisplayValue("impl")).toBeInTheDocument();
  expect(screen.getByDisplayValue("/tmp/impl")).toBeInTheDocument();
});

test("deletes a project from the top page card", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
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
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [] })));
  const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);

  render(
    <MemoryRouter>
      <ProjectListPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("impl")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "削除" }));

  expect(confirmMock).toHaveBeenCalledTimes(1);
  await waitFor(() => {
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/projects/project-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
  await waitFor(() => {
    expect(screen.getByText("Project はまだ登録されていません。")).toBeInTheDocument();
  });
});

test("does not call delete api when deletion is canceled", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
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
  vi.spyOn(window, "confirm").mockReturnValue(false);

  render(
    <MemoryRouter>
      <ProjectListPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("impl")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "削除" }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("reorders project list by drag and drop", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
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
            {
              id: "project-2",
              name: "impl-2",
              repositoryPath: "/tmp/impl-2",
              actionListPath: "tasks/action.yml",
              doneListPath: "tasks/done.yml",
            },
          ],
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          projects: [
            {
              id: "project-2",
              name: "impl-2",
              repositoryPath: "/tmp/impl-2",
              actionListPath: "tasks/action.yml",
              doneListPath: "tasks/done.yml",
            },
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
    expect(screen.getByText("impl-2")).toBeInTheDocument();
  });

  const sourceCard = screen.getByText("impl").closest("article");
  const targetCard = screen.getByText("impl-2").closest("article");
  if (!sourceCard || !targetCard) {
    throw new Error("project cards are missing");
  }
  const dataTransfer = createDataTransfer();
  fireEvent.dragStart(sourceCard, { dataTransfer });
  fireEvent.dragOver(targetCard, { dataTransfer });
  fireEvent.drop(targetCard, { dataTransfer });
  fireEvent.dragEnd(sourceCard, { dataTransfer });

  await waitFor(() => {
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/projects/reorder",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ sourceId: "project-1", targetId: "project-2" }),
      }),
    );
  });

  await waitFor(() => {
    const cardTitles = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(cardTitles).toEqual(["impl-2", "impl"]);
  });
});

test("navigates when clicking project list row area", async () => {
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
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<ProjectListPage />} />
        <Route path="/projects/:projectId" element={<div>project page</div>} />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("impl")).toBeInTheDocument();
  });

  const projectCard = screen.getByText("impl").closest("article");
  if (!projectCard) {
    throw new Error("project card is missing");
  }
  fireEvent.click(projectCard);
  await waitFor(() => {
    expect(screen.getByText("project page")).toBeInTheDocument();
  });
});

function createDataTransfer(): DataTransfer {
  const store: Record<string, string> = {};
  return {
    dropEffect: "none",
    effectAllowed: "all",
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [],
    clearData: (format?: string) => {
      if (!format) {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
        return;
      }
      delete store[format];
    },
    getData: (format: string) => store[format] ?? "",
    setData: (format: string, data: string) => {
      store[format] = data;
    },
    setDragImage: () => {},
  } as unknown as DataTransfer;
}
