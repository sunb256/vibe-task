import { apiFetch } from "../../lib/api";
import type { PromptFile, PromptSummary } from "./types";

type PromptListResponse = {
  prompts: PromptSummary[];
};

export function fetchPrompts() {
  return apiFetch<PromptListResponse>("/api/prompts", { cache: "no-store" });
}

export function fetchPrompt(promptName: string) {
  return apiFetch<PromptFile>(`/api/prompts/${encodeURIComponent(promptName)}`, {
    cache: "no-store",
  });
}

export function updatePrompt(promptName: string, content: string) {
  return apiFetch<PromptFile>(`/api/prompts/${encodeURIComponent(promptName)}`, {
    method: "PATCH",
    json: { content },
  });
}

export function deletePrompt(promptName: string) {
  return apiFetch<void>(`/api/prompts/${encodeURIComponent(promptName)}`, {
    method: "DELETE",
  });
}
