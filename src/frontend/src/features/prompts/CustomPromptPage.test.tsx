import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, vi } from "vitest";

import { CustomPromptPage } from "./CustomPromptPage";

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

test("renders custom prompt list with menu", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        prompts: [
          {
            name: "alpha.md",
            path: "/home/sunb/.codex/prompts/alpha.md",
          },
        ],
      }),
    ),
  );

  render(
    <MemoryRouter initialEntries={["/custom-prompt"]}>
      <CustomPromptPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("alpha.md")).toBeInTheDocument();
  });

  expect(screen.getByRole("link", { name: "Project" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "Custom Prompt" })).toHaveAttribute(
    "href",
    "/custom-prompt",
  );
  expect(screen.getByRole("link", { name: "Skills" })).toHaveAttribute("href", "/skills");
  expect(screen.queryByText("VIBE TASK")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "Custom Prompt" })).toBeInTheDocument();
  const searchInput = screen.getByRole("searchbox", { name: "Search" });
  expect(searchInput).toBeInTheDocument();
  expect(searchInput).toHaveFocus();
  expect(screen.getByText("$HOME/.codex/prompts/alpha.md")).toBeInTheDocument();
  const row = screen.getByText("alpha.md").closest("article");
  expect(row?.querySelector('img[src="/assets/images/file-text.svg"]')).not.toBeNull();
  expect(row).toHaveClass("pl-6", "pr-4", "py-3");
  expect(row).toHaveClass("hover:border-amber-200", "hover:bg-amber-50/60");
  expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();
});

test("renders Windows home path as $HOME in prompt list", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        prompts: [
          {
            name: "alpha.md",
            path: "C:\\Users\\sunb\\.codex\\prompts\\alpha.md",
          },
        ],
      }),
    ),
  );

  render(
    <MemoryRouter initialEntries={["/custom-prompt"]}>
      <CustomPromptPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("alpha.md")).toBeInTheDocument();
  });

  expect(screen.getByText("$HOME/.codex/prompts/alpha.md")).toBeInTheDocument();
});

test("filters prompts by displayed home alias path", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        prompts: [
          {
            name: "alpha.md",
            path: "/home/sunb/.codex/prompts/alpha.md",
          },
        ],
      }),
    ),
  );

  render(
    <MemoryRouter initialEntries={["/custom-prompt"]}>
      <CustomPromptPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("alpha.md")).toBeInTheDocument();
  });

  fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
    target: { value: "$HOME/.codex/prompts/alpha" },
  });

  expect(screen.getByText("alpha.md")).toBeInTheDocument();
});

test("filters prompts by search query", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        prompts: [
          {
            name: "alpha.md",
            path: "/tmp/.codex/prompts/alpha.md",
          },
          {
            name: "beta.md",
            path: "/tmp/prompts/team/beta.md",
          },
        ],
      }),
    ),
  );

  render(
    <MemoryRouter initialEntries={["/custom-prompt"]}>
      <CustomPromptPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("alpha.md")).toBeInTheDocument();
    expect(screen.getByText("beta.md")).toBeInTheDocument();
  });

  const searchInput = screen.getByRole("searchbox", { name: "Search" });
  fireEvent.change(searchInput, { target: { value: "alp" } });
  expect(screen.getByText("alpha.md")).toBeInTheDocument();
  expect(screen.queryByText("beta.md")).not.toBeInTheDocument();

  fireEvent.change(searchInput, { target: { value: "/tmp/prompts/team" } });
  expect(screen.getByText("beta.md")).toBeInTheDocument();
  expect(screen.queryByText("alpha.md")).not.toBeInTheDocument();

  fireEvent.change(searchInput, { target: { value: "not-found" } });
  expect(screen.getByText("検索条件に一致するPromptはありません。")).toBeInTheDocument();

  fireEvent.change(searchInput, { target: { value: "" } });
  expect(screen.getByText("alpha.md")).toBeInTheDocument();
  expect(screen.getByText("beta.md")).toBeInTheDocument();
});

test("edits prompt content in modal editor", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          prompts: [{ name: "alpha.md", path: "/tmp/.codex/prompts/alpha.md" }],
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "alpha.md",
          path: "/tmp/.codex/prompts/alpha.md",
          content: "# Alpha\n",
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "alpha.md",
          path: "/tmp/.codex/prompts/alpha.md",
          content: "# Updated\n",
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          prompts: [{ name: "alpha.md", path: "/tmp/.codex/prompts/alpha.md" }],
        }),
      ),
    );

  render(
    <MemoryRouter initialEntries={["/custom-prompt"]}>
      <CustomPromptPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("alpha.md")).toBeInTheDocument();
  });

  const row = screen.getByText("alpha.md").closest("article");
  if (!row) {
    throw new Error("prompt row is missing");
  }
  fireEvent.click(row);
  await waitFor(() => {
    expect(screen.getByRole("dialog", { name: "編集 - alpha.md" })).toBeInTheDocument();
  });
  const editDialog = screen.getByRole("dialog", { name: "編集 - alpha.md" });
  expect(editDialog.querySelector('img[src="/assets/images/file-text.svg"]')).not.toBeNull();
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

  fireEvent.change(screen.getByLabelText("task-editor"), {
    target: { value: "# Updated\n" },
  });
  fireEvent.click(screen.getByRole("button", { name: "更新" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/prompts/alpha.md",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ content: "# Updated\n" }),
      }),
    );
  });
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "編集 - alpha.md" })).not.toBeInTheDocument();
  });
});

test("deletes prompt from list", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          prompts: [{ name: "alpha.md", path: "/tmp/.codex/prompts/alpha.md" }],
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ prompts: [] })));
  vi.spyOn(window, "confirm").mockReturnValue(true);

  render(
    <MemoryRouter initialEntries={["/custom-prompt"]}>
      <CustomPromptPage />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText("alpha.md")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "削除" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/prompts/alpha.md",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
  await waitFor(() => {
    expect(screen.getByText("Prompt は見つかりませんでした。")).toBeInTheDocument();
  });
});
