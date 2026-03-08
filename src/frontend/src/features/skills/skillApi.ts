import { apiFetch } from "../../lib/api";
import type { SkillFile, SkillSummary } from "./types";

type SkillListResponse = {
  skills: SkillSummary[];
};

type SkillScope = Pick<SkillSummary, "source" | "projectName">;

export function fetchSkills() {
  return apiFetch<SkillListResponse>("/api/skills", { cache: "no-store" });
}

export function fetchSkill(skillName: string, scope?: SkillScope) {
  return apiFetch<SkillFile>(skillUrl(skillName, scope), {
    cache: "no-store",
  });
}

export function createSkill(name: string, content: string) {
  return apiFetch<SkillFile>("/api/skills", {
    method: "POST",
    json: { name, content },
  });
}

export function updateSkill(skillName: string, content: string, scope?: SkillScope) {
  return apiFetch<SkillFile>(skillUrl(skillName, scope), {
    method: "PATCH",
    json: { content },
  });
}

export function deleteSkill(skillName: string, scope?: SkillScope) {
  return apiFetch<void>(skillUrl(skillName, scope), {
    method: "DELETE",
  });
}

function skillUrl(skillName: string, scope?: SkillScope) {
  const base = `/api/skills/${encodeURIComponent(skillName)}`;
  if (!scope || scope.source === "global") {
    return base;
  }
  const query = new URLSearchParams({
    source: scope.source,
    projectName: scope.projectName,
  });
  return `${base}?${query.toString()}`;
}
