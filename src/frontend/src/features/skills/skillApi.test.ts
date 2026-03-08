import { afterEach, vi } from "vitest";

import { createSkill, deleteSkill, fetchSkill, fetchSkills, updateSkill } from "./skillApi";

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

test("createSkill, updateSkill, deleteSkill use correct HTTP methods and payload", async () => {
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
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));

  await createSkill("alpha", "# Alpha Skill\n");
  await updateSkill("alpha", "# Updated Skill\n");
  await deleteSkill("alpha");

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "/api/skills",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "alpha", content: "# Alpha Skill\n" }),
    }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    3,
    "/api/skills/alpha",
    expect.objectContaining({
      method: "DELETE",
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

test("project skill operations include source and projectName query", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "local",
          path: "/tmp/repo/.codex/skills/local/SKILL.md",
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
          name: "local",
          path: "/tmp/repo/.codex/skills/local/SKILL.md",
          content: "# Updated Local Skill\n",
          source: "project",
          projectName: "impl",
          editable: true,
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));

  const projectScope = { source: "project" as const, projectName: "impl" };
  await fetchSkill("local", projectScope);
  await updateSkill("local", "# Updated Local Skill\n", projectScope);
  await deleteSkill("local", projectScope);

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "/api/skills/local?source=project&projectName=impl",
    expect.objectContaining({ cache: "no-store" }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/skills/local?source=project&projectName=impl",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ content: "# Updated Local Skill\n" }),
    }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    3,
    "/api/skills/local?source=project&projectName=impl",
    expect.objectContaining({ method: "DELETE" }),
  );
});
