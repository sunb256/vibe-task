import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, vi } from "vitest";

import { SkillsPage } from "./SkillsPage";

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

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders skills list and global menu", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        skills: [
          {
            name: "alpha",
            path: "/home/sunb/.codex/skills/alpha/SKILL.md",
            source: "global",
            projectName: "",
            editable: true,
          },
        ],
      }),
    ),
  );

  render(
    <MemoryRouter initialEntries={["/skills"]}>
      <SkillsPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });

  expect(screen.getByRole("link", { name: "Project" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "Custom Prompt" })).toHaveAttribute(
    "href",
    "/custom-prompt",
  );
  expect(screen.getByRole("link", { name: "Skills" })).toHaveAttribute("href", "/skills");
  expect(screen.getByRole("heading", { level: 1, name: "Skills" })).toBeInTheDocument();
  expect(screen.getByText("$HOME/.codex/skills/alpha/SKILL.md")).toBeInTheDocument();
  expect(screen.getByRole("searchbox", { name: "Search" })).toBeInTheDocument();
  expect(screen.getByRole("searchbox", { name: "Search" })).toHaveFocus();
  expect(screen.getByLabelText("ファイルパスも検索")).not.toBeChecked();
  expect(screen.getByRole("button", { name: "新規Skill" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument();
});

test("filters skills by search query", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        skills: [
          {
            name: "alpha",
            path: "/tmp/.codex/skills/alpha/SKILL.md",
            source: "global",
            projectName: "",
            editable: true,
          },
          {
            name: "beta",
            path: "/tmp/.codex/skills/beta/SKILL.md",
            source: "global",
            projectName: "",
            editable: true,
          },
        ],
      }),
    ),
  );

  render(
    <MemoryRouter initialEntries={["/skills"]}>
      <SkillsPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
    target: { value: "alp" },
  });

  expect(screen.getByText("alpha")).toBeInTheDocument();
  expect(screen.queryByText("beta")).not.toBeInTheDocument();

  fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
    target: { value: "zzz" },
  });

  expect(screen.getByText("検索条件に一致するSkillはありません。")).toBeInTheDocument();
});

test("path search works only when checkbox is enabled", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        skills: [
          {
            name: "alpha",
            path: "/tmp/.codex/skills/alpha/SKILL.md",
            source: "global",
            projectName: "",
            editable: true,
          },
          {
            name: "beta",
            path: "/tmp/.codex/skills/team-beta-only/SKILL.md",
            source: "global",
            projectName: "",
            editable: true,
          },
        ],
      }),
    ),
  );

  render(
    <MemoryRouter initialEntries={["/skills"]}>
      <SkillsPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
    target: { value: "team-beta-only" },
  });
  expect(screen.getByText("検索条件に一致するSkillはありません。")).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText("ファイルパスも検索"));
  expect(screen.getByText("beta")).toBeInTheDocument();
  expect(screen.queryByText("alpha")).not.toBeInTheDocument();
});

test("creates a new skill from new button", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({ skills: [] })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "new-skill",
          path: "/tmp/.codex/skills/new-skill/SKILL.md",
          content: "# new-skill\n",
        }),
        { status: 201 },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          skills: [
            {
              name: "new-skill",
              path: "/tmp/.codex/skills/new-skill/SKILL.md",
              source: "global",
              projectName: "",
              editable: true,
            },
          ],
        }),
      ),
    );
  vi.spyOn(window, "prompt").mockReturnValue("new-skill");

  render(
    <MemoryRouter initialEntries={["/skills"]}>
      <SkillsPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "新規Skill" })).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole("button", { name: "新規Skill" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/skills",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "new-skill", content: "# new-skill\n" }),
      }),
    );
  });
  expect(screen.getByRole("dialog", { name: "編集 - new-skill" })).toBeInTheDocument();
});

test("edits skill content in modal editor", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          skills: [
            {
              name: "alpha",
              path: "/tmp/.codex/skills/alpha/SKILL.md",
              source: "global",
              projectName: "",
              editable: true,
            },
          ],
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "alpha",
          path: "/tmp/.codex/skills/alpha/SKILL.md",
          content: "# Alpha Skill\n",
          source: "global",
          projectName: "",
          editable: true,
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "alpha",
          path: "/tmp/.codex/skills/alpha/SKILL.md",
          content: "# Updated Skill\n",
          source: "global",
          projectName: "",
          editable: true,
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          skills: [
            {
              name: "alpha",
              path: "/tmp/.codex/skills/alpha/SKILL.md",
              source: "global",
              projectName: "",
              editable: true,
            },
          ],
        }),
      ),
    );

  render(
    <MemoryRouter initialEntries={["/skills"]}>
      <SkillsPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });

  const row = screen.getByText("alpha").closest("article");
  if (!row) {
    throw new Error("skill row is missing");
  }
  fireEvent.click(row);
  await waitFor(() => {
    expect(screen.getByRole("dialog", { name: "編集 - alpha" })).toBeInTheDocument();
  });
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/skills/file?path=%2Ftmp%2F.codex%2Fskills%2Falpha%2FSKILL.md",
    expect.objectContaining({ cache: "no-store" }),
  );

  fireEvent.change(screen.getByLabelText("task-editor"), {
    target: { value: "# Updated Skill\n" },
  });
  fireEvent.click(screen.getByRole("button", { name: "更新" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/skills/file",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          path: "/tmp/.codex/skills/alpha/SKILL.md",
          content: "# Updated Skill\n",
        }),
      }),
    );
  });
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "編集 - alpha" })).not.toBeInTheDocument();
  });
});

test("edits project skill content in modal editor", async () => {
  const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          skills: [
            {
              name: "local-skill",
              path: "/tmp/repo/.codex/skills/local-skill/SKILL.md",
              source: "project",
              projectName: "impl",
              editable: true,
            },
          ],
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "local-skill",
          path: "/tmp/repo/.codex/skills/local-skill/SKILL.md",
          content: "# Local Skill\n",
          source: "project",
          projectName: "impl",
          editable: true,
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "local-skill",
          path: "/tmp/repo/.codex/skills/local-skill/SKILL.md",
          content: "# Updated Local Skill\n",
          source: "project",
          projectName: "impl",
          editable: true,
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          skills: [
            {
              name: "local-skill",
              path: "/tmp/repo/.codex/skills/local-skill/SKILL.md",
              source: "project",
              projectName: "impl",
              editable: true,
            },
          ],
        }),
      ),
    );

  render(
    <MemoryRouter initialEntries={["/skills"]}>
      <SkillsPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("local-skill")).toBeInTheDocument();
  });

  expect(screen.getByText("Project: impl")).toBeInTheDocument();
  fireEvent.click(screen.getByText("local-skill"));
  await waitFor(() => {
    expect(screen.getByRole("dialog", { name: "編集 - local-skill" })).toBeInTheDocument();
  });
  fireEvent.change(screen.getByLabelText("task-editor"), {
    target: { value: "# Updated Local Skill\n" },
  });
  fireEvent.click(screen.getByRole("button", { name: "更新" }));
  expect(confirmMock).toHaveBeenCalledWith(
    "プロジェクト配下のSkillを更新します。続行しますか？\n/tmp/repo/.codex/skills/local-skill/SKILL.md",
  );
  await waitFor(() => {
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/skills/file",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          path: "/tmp/repo/.codex/skills/local-skill/SKILL.md",
          content: "# Updated Local Skill\n",
        }),
      }),
    );
  });
});

test("deletes project skill with confirmation", async () => {
  const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          skills: [
            {
              name: "local-skill",
              path: "/tmp/repo/.codex/skills/local-skill/SKILL.md",
              source: "project",
              projectName: "impl",
              editable: true,
            },
          ],
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ skills: [] })));

  render(
    <MemoryRouter initialEntries={["/skills"]}>
      <SkillsPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("local-skill")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "削除" }));

  expect(confirmMock).toHaveBeenCalledWith(
    "プロジェクト配下のSkillを削除します。続行しますか？\n/tmp/repo/.codex/skills/local-skill/SKILL.md",
  );
  await waitFor(() => {
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/skills/file",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({
          path: "/tmp/repo/.codex/skills/local-skill/SKILL.md",
        }),
      }),
    );
  });
  await waitFor(() => {
    expect(screen.getByText("Skill は見つかりませんでした。")).toBeInTheDocument();
  });
});
