import { apiFetch } from "../../lib/api";
import type { Project, ProjectFormState } from "./types";

type ProjectListResponse = {
  projects: Project[];
};

type ProjectExportResponse = {
  content: string;
};

export function fetchProjects() {
  return apiFetch<ProjectListResponse>("/api/projects");
}

export function createProject(payload: ProjectFormState) {
  return apiFetch<Project>("/api/projects", {
    method: "POST",
    json: payload,
  });
}

export function exportProjectsFile() {
  return apiFetch<ProjectExportResponse>("/api/projects/export");
}

export function importProjectsFile(content: string) {
  return apiFetch<void>("/api/projects/import", {
    method: "POST",
    json: { content },
  });
}
