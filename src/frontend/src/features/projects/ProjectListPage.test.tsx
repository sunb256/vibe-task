import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";

import { ProjectListPage } from "./ProjectListPage";

afterEach(() => {
  vi.restoreAllMocks();
});

function settingsResponse(headerBand = "zinc", customHeaderColor = "") {
  return new Response(JSON.stringify({ headerBand, customHeaderColor }));
}

function mockFetchRoutes(routes: Record<string, Response | Response[]>) {
  const routeMap = new Map(
    Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? value : [value]]),
  );

  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const key = requestKey(input, init);
    const responses = routeMap.get(key);
    if (!responses || responses.length === 0) {
      throw new Error(`Unexpected fetch: ${key}`);
    }
    return responses.shift() as Response;
  });
}

function requestKey(input: string | URL | Request, init?: RequestInit) {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
  return `${method} ${url}`;
}

test("renders project list", async () => {
  const fetchMock = mockFetchRoutes({
    "GET /api/settings": settingsResponse(),
    "GET /api/projects": new Response(
      JSON.stringify({
        projects: [
          {
            id: "project-1",
            name: "impl",
            repositoryPath: "/tmp/impl",
          },
        ],
      }),
    ),
    "PATCH /api/settings": [
      new Response(JSON.stringify({ headerBand: "navy", customHeaderColor: "#1f2937" })),
      new Response(JSON.stringify({ headerBand: "custom", customHeaderColor: "#123456" })),
    ],
  });

  render(
    <MemoryRouter>
      <ProjectListPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("impl")).toBeInTheDocument();
  });
  expect(screen.queryByText("VIBE TASK")).not.toBeInTheDocument();
  const pageTitle = screen.getByRole("heading", { level: 1, name: "Project 一覧" });
  expect(pageTitle).toBeInTheDocument();
  expect(pageTitle).toHaveClass("text-xl");
  expect(screen.getByRole("link", { name: "Project" })).toHaveAttribute("href", "/");
  const projectMenuLink = screen.getByRole("link", { name: "Project" });
  expect(
    projectMenuLink.querySelector('img[src="/assets/images/vibe_task_logo_active.png"]'),
  ).not.toBeNull();
  expect(screen.getByRole("link", { name: "Custom Prompt" })).toHaveAttribute(
    "href",
    "/custom-prompt",
  );
  expect(screen.getByRole("link", { name: "Skills" })).toHaveAttribute("href", "/skills");
  expect(screen.queryByRole("link", { name: "Project 一覧" })).not.toBeInTheDocument();
  const newProjectButton = screen.getByRole("button", { name: "新規プロジェクト" });
  expect(newProjectButton).toBeInTheDocument();
  expect(newProjectButton).toHaveClass("bg-[var(--accent)]", "text-white");
  expect(screen.getByRole("button", { name: "Setting" })).toBeInTheDocument();
  expect(screen.getByRole("searchbox", { name: "Search" })).toBeInTheDocument();
  const searchInput = screen.getByRole("searchbox", { name: "Search" });
  expect(searchInput).toHaveFocus();
  expect(searchInput.parentElement?.parentElement).toHaveClass("flex", "items-center", "gap-2");
  expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();
  expect(screen.getByRole("separator")).toBeInTheDocument();
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
  expect(projectCard).toHaveClass("pl-6", "pr-4", "py-3");
  expect(projectCard).toHaveClass("hover:border-amber-200", "hover:bg-amber-50/60");
  expect(projectList).toHaveClass("space-y-3");
  expect(projectList).not.toHaveClass("md:grid-cols-2");
  expect(screen.queryByRole("link", { name: "Open Project" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "新規プロジェクト" }));
  const createDialog = screen.getByRole("dialog", { name: "新規作成" });
  expect(createDialog).toBeInTheDocument();
  expect(createDialog).toHaveClass("max-w-5xl");
  expect(
    screen.queryByText("repositoryPath は実在するリポジトリのディレクトリを指定します。"),
  ).not.toBeInTheDocument();
  const repositoryPathInput = screen.getByLabelText("repositoryPath");
  const nameInput = screen.getByLabelText("name");
  expect(
    repositoryPathInput.compareDocumentPosition(nameInput) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.change(repositoryPathInput, { target: { value: "/tmp/auto-name-repo" } });
  expect(nameInput).toHaveValue("auto-name-repo");
  expect(repositoryPathInput.parentElement?.parentElement).toHaveClass("md:col-span-2");
  expect(nameInput.parentElement?.parentElement).toHaveClass("md:grid-cols-2");
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
  const settingsDialog = screen.getByRole("dialog", { name: "Setting" });
  const globalHeader = document.querySelector("header.fixed");
  expect(settingsDialog).toBeInTheDocument();
  expect(globalHeader).not.toBeNull();
  if (!globalHeader) {
    throw new Error("global header is missing");
  }
  expect(settingsDialog).toHaveClass("max-w-5xl");
  expect(globalHeader).toHaveStyle({ backgroundColor: "rgba(9, 9, 11, 0.94)" });
  expect(screen.getAllByRole("radio", { name: /Graphite|Navy|Copper|Forest|Plum|Charcoal|Custom/ })).toHaveLength(7);
  expect(screen.getByRole("radio", { name: /Graphite/ })).toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name: /Navy/ }));
  await waitFor(() => {
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ headerBand: "navy", customHeaderColor: "#1f2937" }),
      }),
    );
  });
  await waitFor(() => {
    expect(globalHeader).toHaveStyle({ backgroundColor: "rgba(30, 41, 59, 0.94)" });
  });
  fireEvent.change(screen.getByLabelText("HEX"), { target: { value: "#123456" } });
  fireEvent.click(screen.getByRole("button", { name: "任意色を適用" }));
  await waitFor(() => {
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ headerBand: "custom", customHeaderColor: "#123456" }),
      }),
    );
  });
  await waitFor(() => {
    expect(globalHeader).toHaveStyle({ backgroundColor: "rgba(18, 52, 86, 0.94)" });
  });
  expect(screen.getByRole("button", { name: "projects.yml をエクスポート" })).toBeInTheDocument();
  expect(screen.queryByText("projects.yml を読み込んで置き換えます。")).not.toBeInTheDocument();
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
  const editDialog = screen.getByRole("dialog", { name: "プロジェクト編集 - #project-1" });
  expect(editDialog).toBeInTheDocument();
  expect(editDialog).toHaveClass("max-w-5xl");
  expect(screen.getByDisplayValue("impl")).toBeInTheDocument();
  expect(screen.getByDisplayValue("/tmp/impl")).toBeInTheDocument();
});

test("deletes a project from the top page card", async () => {
  const fetchMock = mockFetchRoutes({
    "GET /api/settings": settingsResponse(),
    "GET /api/projects": [
      new Response(
        JSON.stringify({
          projects: [
            {
              id: "project-1",
              name: "impl",
              repositoryPath: "/tmp/impl",
            },
          ],
        }),
      ),
      new Response(JSON.stringify({ projects: [] })),
    ],
    "DELETE /api/projects/project-1": new Response(null, { status: 204 }),
  });
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
      3,
      "/api/projects/project-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
  await waitFor(() => {
    expect(screen.getByText("Project はまだ登録されていません。")).toBeInTheDocument();
  });
});

test("does not call delete api when deletion is canceled", async () => {
  const fetchMock = mockFetchRoutes({
    "GET /api/settings": settingsResponse(),
    "GET /api/projects": new Response(
      JSON.stringify({
        projects: [
          {
            id: "project-1",
            name: "impl",
            repositoryPath: "/tmp/impl",
          },
        ],
      }),
    ),
  });
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

  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("filters project list incrementally by search query", async () => {
  mockFetchRoutes({
    "GET /api/settings": settingsResponse(),
    "GET /api/projects": new Response(
      JSON.stringify({
        projects: [
          {
            id: "project-1",
            name: "impl",
            repositoryPath: "/tmp/impl",
          },
          {
            id: "project-2",
            name: "vibe-task",
            repositoryPath: "/home/user/ghq/vibe-task",
          },
        ],
      }),
    ),
  });

  render(
    <MemoryRouter>
      <ProjectListPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("impl")).toBeInTheDocument();
    expect(screen.getByText("vibe-task")).toBeInTheDocument();
  });

  const searchInput = screen.getByRole("searchbox", { name: "Search" });
  fireEvent.change(searchInput, { target: { value: "vibe" } });
  expect(screen.queryByText("impl")).not.toBeInTheDocument();
  expect(screen.getByText("vibe-task")).toBeInTheDocument();

  fireEvent.change(searchInput, { target: { value: "not-found" } });
  expect(screen.getByText("検索条件に一致するProjectはありません。")).toBeInTheDocument();

  fireEvent.change(searchInput, { target: { value: "/tmp/impl" } });
  expect(screen.getByText("impl")).toBeInTheDocument();
  expect(screen.queryByText("vibe-task")).not.toBeInTheDocument();

  fireEvent.change(searchInput, { target: { value: "" } });
  expect(screen.getByText("impl")).toBeInTheDocument();
  expect(screen.getByText("vibe-task")).toBeInTheDocument();
});

test("reorders project list by drag and drop", async () => {
  const fetchMock = mockFetchRoutes({
    "GET /api/settings": settingsResponse(),
    "GET /api/projects": [
      new Response(
        JSON.stringify({
          projects: [
            {
              id: "project-1",
              name: "impl",
              repositoryPath: "/tmp/impl",
            },
            {
              id: "project-2",
              name: "impl-2",
              repositoryPath: "/tmp/impl-2",
            },
          ],
        }),
      ),
      new Response(
        JSON.stringify({
          projects: [
            {
              id: "project-2",
              name: "impl-2",
              repositoryPath: "/tmp/impl-2",
            },
            {
              id: "project-1",
              name: "impl",
              repositoryPath: "/tmp/impl",
            },
          ],
        }),
      ),
    ],
    "PATCH /api/projects/reorder": new Response(null, { status: 204 }),
  });

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
      3,
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
  mockFetchRoutes({
    "GET /api/settings": settingsResponse(),
    "GET /api/projects": new Response(
      JSON.stringify({
        projects: [
          {
            id: "project-1",
            name: "impl",
            repositoryPath: "/tmp/impl",
          },
        ],
      }),
    ),
  });

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
