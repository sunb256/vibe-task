import { apiFetch } from "../../lib/api";
import type { Project, ProjectFormState } from "./types";

type ProjectListResponse = {
  projects: Project[];
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
