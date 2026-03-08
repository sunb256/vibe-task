import { apiFetch } from "../../lib/api";
import type { SkillFile, SkillSummary } from "./types";

type SkillListResponse = {
  skills: SkillSummary[];
};

export function fetchSkills() {
  return apiFetch<SkillListResponse>("/api/skills", { cache: "no-store" });
}

export function fetchSkill(skillName: string) {
  return apiFetch<SkillFile>(`/api/skills/${encodeURIComponent(skillName)}`, {
    cache: "no-store",
  });
}

export function createSkill(name: string, content: string) {
  return apiFetch<SkillFile>("/api/skills", {
    method: "POST",
    json: { name, content },
  });
}

export function updateSkill(skillName: string, content: string) {
  return apiFetch<SkillFile>(`/api/skills/${encodeURIComponent(skillName)}`, {
    method: "PATCH",
    json: { content },
  });
}

export function deleteSkill(skillName: string) {
  return apiFetch<void>(`/api/skills/${encodeURIComponent(skillName)}`, {
    method: "DELETE",
  });
}
