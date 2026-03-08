import { afterEach, vi } from "vitest";

import { fetchPrompt, fetchPrompts, updatePrompt } from "./promptApi";

afterEach(() => {
  vi.restoreAllMocks();
});

test("fetchPrompts and fetchPrompt disable cache to avoid stale content", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({ prompts: [] })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "alpha.md",
          path: "/tmp/.codex/prompts/alpha.md",
          content: "# Alpha\n",
        }),
      ),
    );

  await fetchPrompts();
  await fetchPrompt("alpha.md");

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "/api/prompts",
    expect.objectContaining({ cache: "no-store" }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/prompts/alpha.md",
    expect.objectContaining({ cache: "no-store" }),
  );
});

test("updatePrompt sends PATCH request with updated content", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        name: "alpha.md",
        path: "/tmp/.codex/prompts/alpha.md",
        content: "# Updated\n",
      }),
    ),
  );

  await updatePrompt("alpha.md", "# Updated\n");

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/prompts/alpha.md",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ content: "# Updated\n" }),
    }),
  );
});
