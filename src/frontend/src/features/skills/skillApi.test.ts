import { afterEach, vi } from "vitest";

import { createSkill, fetchSkill, fetchSkills, updateSkill } from "./skillApi";

afterEach(() => {
  vi.restoreAllMocks();
});

test("fetchSkills and fetchSkill request the skills endpoints with no-store", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({ skills: [] })))
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
    );

  await fetchSkills();
  await fetchSkill("alpha");

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "/api/skills",
    expect.objectContaining({ cache: "no-store" }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/skills/alpha",
    expect.objectContaining({ cache: "no-store" }),
  );
});

test("createSkill and updateSkill use correct HTTP methods and payload", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
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
    );

  await createSkill("alpha", "# Alpha Skill\n");
  await updateSkill("alpha", "# Updated Skill\n");

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "/api/skills",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "alpha", content: "# Alpha Skill\n" }),
    }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/skills/alpha",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ content: "# Updated Skill\n" }),
    }),
  );
});
