import { afterEach, vi } from "vitest";

import {
  createSkill,
  deleteSkillByPath,
  fetchSkill,
  fetchSkillByPath,
  fetchSkills,
  updateSkill,
  updateSkillByPath,
} from "./skillApi";

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

test("fetchSkillByPath, updateSkillByPath and deleteSkillByPath use path-based endpoints", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
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
    .mockResolvedValueOnce(new Response(null, { status: 204 }));

  await fetchSkillByPath("/tmp/repo/.codex/skills/local-skill/SKILL.md");
  await updateSkillByPath("/tmp/repo/.codex/skills/local-skill/SKILL.md", "# Updated Local Skill\n");
  await deleteSkillByPath("/tmp/repo/.codex/skills/local-skill/SKILL.md");

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "/api/skills/file?path=%2Ftmp%2Frepo%2F.codex%2Fskills%2Flocal-skill%2FSKILL.md",
    expect.objectContaining({ cache: "no-store" }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/skills/file",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({
        path: "/tmp/repo/.codex/skills/local-skill/SKILL.md",
        content: "# Updated Local Skill\n",
      }),
    }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    3,
    "/api/skills/file",
    expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({
        path: "/tmp/repo/.codex/skills/local-skill/SKILL.md",
      }),
    }),
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
