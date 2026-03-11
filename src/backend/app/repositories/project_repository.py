from pathlib import Path
from io import StringIO
import re

from ruamel.yaml import YAML
from ruamel.yaml.error import YAMLError

from app.errors import AppError
from app.models import AppSettingsRecord, ProjectRecord

HEADER_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class ProjectRepository:
    def __init__(self, projects_file: Path) -> None:
        self.projects_file = projects_file
        self.yaml = YAML()
        self.yaml.preserve_quotes = True
        self.yaml.indent(mapping=2, sequence=4, offset=2)

    def list_projects(self) -> list[ProjectRecord]:
        document = self._load_document()
        projects = self._read_projects(document)
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
    ) -> ProjectRecord:
        document = self._load_document()
        projects = document.setdefault("projects", [])
        project = ProjectRecord(
            id=self._next_project_id(projects),
            name=name,
            repository_path=repository_path,
        )
        projects.append(project.to_dict())
        self._write_document(document)
        return project

    def update_project(
        self,
        project_id: str,
        name: str,
        repository_path: str,
    ) -> ProjectRecord:
        document = self._load_document()
        projects = document.setdefault("projects", [])
        index = self._find_project_index(projects, project_id)
        project = ProjectRecord(
            id=project_id,
            name=name,
            repository_path=repository_path,
        )
        projects[index] = project.to_dict()
        self._write_document(document)
        return project

    def reorder_projects(self, source_id: str, target_id: str) -> None:
        if source_id == target_id:
            return
        document = self._load_document()
        projects = document.setdefault("projects", [])
        source_index = self._find_project_index(projects, source_id)
        target_index = self._find_project_index(projects, target_id)
        projects[source_index], projects[target_index] = (
            projects[target_index],
            projects[source_index],
        )
        self._write_document(document)

    def delete_project(self, project_id: str) -> None:
        document = self._load_document()
        projects = document.setdefault("projects", [])
        index = self._find_project_index(projects, project_id)
        del projects[index]
        self._write_document(document)

    def export_projects_text(self) -> str:
        document = self._load_document()
        return self._dump_document(document)

    def import_projects_text(self, content: str) -> None:
        document = self._parse_document(content)
        self._write_document(document)

    def get_app_settings(self) -> AppSettingsRecord:
        document = self._load_document()
        return self._to_app_settings(document.get("settings"))

    def update_app_settings(self, header_color: str) -> AppSettingsRecord:
        document = self._load_document()
        document["settings"] = {"headerColor": header_color}
        self._write_document(document)
        return self._to_app_settings(document["settings"])

    def _next_project_id(self, projects: list[dict]) -> str:
        return str(self._max_project_id(projects) + 1)

    def _max_project_id(self, projects: list[dict]) -> int:
        max_id = 0
        for item in projects:
            if not isinstance(item, dict):
                continue
            value = item.get("id")
            if isinstance(value, int):
                max_id = max(max_id, value)
                continue
            if isinstance(value, str) and value.isdigit():
                max_id = max(max_id, int(value))
        return max_id

    def _find_project_index(self, projects: list[dict], project_id: str) -> int:
        for index, item in enumerate(projects):
            if isinstance(item, dict) and str(item.get("id", "")) == project_id:
                return index
        raise AppError("project not found", 404)

    def _load_document(self) -> dict:
        if not self.projects_file.exists():
            document = {"projects": []}
            self._write_document(document)
            return document
        with self.projects_file.open("r", encoding="utf-8") as handle:
            try:
                document = self.yaml.load(handle) or {}
            except YAMLError as error:
                raise AppError("projects file is invalid", 400) from error
        if not isinstance(document, dict):
            raise AppError("projects file is invalid", 400)
        self._read_projects(document)
        self._read_settings(document)
        document.setdefault("projects", [])
        return document

    def _write_document(self, document: dict) -> None:
        self.projects_file.parent.mkdir(parents=True, exist_ok=True)
        with self.projects_file.open("w", encoding="utf-8") as handle:
            self.yaml.dump(document, handle)

    def _parse_document(self, content: str) -> dict:
        try:
            document = self.yaml.load(content) or {}
        except YAMLError as error:
            raise AppError("projects file is invalid", 400) from error
        if not isinstance(document, dict):
            raise AppError("projects file is invalid", 400)
        self._read_projects(document)
        self._read_settings(document)
        document.setdefault("projects", [])
        return document

    def _read_projects(self, document: dict) -> list[dict]:
        projects = document.get("projects", [])
        if not isinstance(projects, list):
            raise AppError("projects file is invalid", 400)
        for item in projects:
            if not isinstance(item, dict):
                raise AppError("projects file is invalid", 400)
            self._to_project_record(item)
        return projects

    def _read_settings(self, document: dict) -> AppSettingsRecord:
        return self._to_app_settings(document.get("settings"))

    def _dump_document(self, document: dict) -> str:
        buffer = StringIO()
        self.yaml.dump(document, buffer)
        return buffer.getvalue()

    def _to_project_record(self, item: dict) -> ProjectRecord:
        try:
            return ProjectRecord(
                id=str(item["id"]),
                name=str(item["name"]),
                repository_path=str(item["repositoryPath"]),
            )
        except (KeyError, TypeError) as error:
            raise AppError("projects file is invalid", 400) from error

    def _to_app_settings(self, item: object) -> AppSettingsRecord:
        if item is None:
            return AppSettingsRecord()
        if not isinstance(item, dict):
            raise AppError("projects file is invalid", 400)
        header_color = item.get("headerColor", AppSettingsRecord().header_color)
        if not isinstance(header_color, str) or not HEADER_COLOR_RE.fullmatch(header_color):
            raise AppError("projects file is invalid", 400)
        return AppSettingsRecord(header_color=header_color.lower())
