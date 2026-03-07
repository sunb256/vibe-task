from pathlib import Path
from uuid import uuid4

from ruamel.yaml import YAML

from app.errors import AppError
from app.models import ProjectRecord


class ProjectRepository:
    def __init__(self, projects_file: Path) -> None:
        self.projects_file = projects_file
        self.yaml = YAML()
        self.yaml.preserve_quotes = True
        self.yaml.indent(mapping=2, sequence=4, offset=2)

    def list_projects(self) -> list[ProjectRecord]:
        document = self._load_document()
        projects = document.get("projects", [])
        return [self._to_project_record(item) for item in projects]

    def get_project(self, project_id: str) -> ProjectRecord:
        for project in self.list_projects():
            if project.id == project_id:
                return project
        raise AppError("project not found", 404)

    def create_project(
        self,
        name: str,
        repository_path: str,
        action_list_path: str,
        done_list_path: str,
    ) -> ProjectRecord:
        document = self._load_document()
        project = ProjectRecord(
            id=uuid4().hex,
            name=name,
            repository_path=repository_path,
            action_list_path=action_list_path,
            done_list_path=done_list_path,
        )
        document.setdefault("projects", []).append(project.to_dict())
        self._write_document(document)
        return project

    def _load_document(self) -> dict:
        if not self.projects_file.exists():
            return {"projects": []}
        with self.projects_file.open("r", encoding="utf-8") as handle:
            document = self.yaml.load(handle) or {}
        if not isinstance(document, dict):
            raise AppError("projects file is invalid", 400)
        projects = document.get("projects", [])
        if not isinstance(projects, list):
            raise AppError("projects file is invalid", 400)
        document.setdefault("projects", [])
        return document

    def _write_document(self, document: dict) -> None:
        self.projects_file.parent.mkdir(parents=True, exist_ok=True)
        with self.projects_file.open("w", encoding="utf-8") as handle:
            self.yaml.dump(document, handle)

    def _to_project_record(self, item: dict) -> ProjectRecord:
        try:
            return ProjectRecord(
                id=str(item["id"]),
                name=str(item["name"]),
                repository_path=str(item["repositoryPath"]),
                action_list_path=str(item["actionListPath"]),
                done_list_path=str(item["doneListPath"]),
            )
        except KeyError as error:
            raise AppError("projects file is invalid", 400) from error
