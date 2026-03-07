from pathlib import Path

from app.errors import AppError
from app.models import ProjectRecord
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository


class ProjectService:
    def __init__(self, project_repository: ProjectRepository) -> None:
        self.project_repository = project_repository
        self.task_repository = TaskRepository()

    def list_projects(self) -> list[ProjectRecord]:
        return self.project_repository.list_projects()

    def create_project(self, payload: dict) -> ProjectRecord:
        name = self._require_text(payload, "name")
        repository_path = self._resolve_repository_path(payload)
        action_list_path = self._require_relative_path(payload, "actionListPath")
        done_list_path = self._require_relative_path(payload, "doneListPath")
        preview = ProjectRecord(
            id="preview",
            name=name,
            repository_path=str(repository_path),
            action_list_path=action_list_path,
            done_list_path=done_list_path,
        )
        self.task_repository.list_tasks(preview)
        return self.project_repository.create_project(
            name=name,
            repository_path=str(repository_path),
            action_list_path=action_list_path,
            done_list_path=done_list_path,
        )

    def _resolve_repository_path(self, payload: dict) -> Path:
        repository_path = self._require_text(payload, "repositoryPath")
        resolved = Path(repository_path).expanduser().resolve()
        if not resolved.exists() or not resolved.is_dir():
            raise AppError("repositoryPath must be an existing directory", 400)
        return resolved

    def _require_relative_path(self, payload: dict, field: str) -> str:
        value = self._require_text(payload, field)
        if Path(value).is_absolute():
            raise AppError(f"{field} must be relative", 400)
        return value

    def _require_text(self, payload: dict, field: str) -> str:
        value = payload.get(field)
        if not isinstance(value, str) or not value.strip():
            raise AppError(f"{field} is required", 400)
        return value.strip()
