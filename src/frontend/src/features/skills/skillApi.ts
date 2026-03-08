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

export function fetchSkillByPath(path: string) {
  const params = new URLSearchParams({ path });
  return apiFetch<SkillFile>(`/api/skills/file?${params.toString()}`, {
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

export function updateSkillByPath(path: string, content: string) {
  return apiFetch<SkillFile>("/api/skills/file", {
    method: "PATCH",
    json: { path, content },
  });
}

export function deleteSkillByPath(path: string) {
  return apiFetch<void>("/api/skills/file", {
    method: "DELETE",
    json: { path },
  });
}
