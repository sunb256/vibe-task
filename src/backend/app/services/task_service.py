from app.models import RunnerHistoryRecord, TaskRecord
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository


class TaskService:
    def __init__(self, project_repository: ProjectRepository) -> None:
        self.project_repository = project_repository
        tasks_root = self.project_repository.projects_file.parent / "projects"
        self.task_repository = TaskRepository(tasks_root)

    def list_tasks(self, project_id: str) -> list[TaskRecord]:
        project = self._load_project(project_id)
        return self.task_repository.list_tasks(project)

    def list_runner_history(self, project_id: str) -> list[RunnerHistoryRecord]:
        project = self._load_project(project_id)
        return self.task_repository.list_runner_history(project)

    def get_task(self, project_id: str, source: str, task_id: str) -> TaskRecord:
        project = self._load_project(project_id)
        return self.task_repository.get_task(project, source, task_id)

    def update_task(
        self,
        project_id: str,
        source: str,
        task_id: str,
        action: str,
        next_source: str | None,
    ) -> TaskRecord:
        project = self._load_project(project_id)
        return self.task_repository.update_task(project, source, task_id, action, next_source)

    def delete_task(self, project_id: str, source: str, task_id: str) -> None:
        project = self._load_project(project_id)
        self.task_repository.delete_task(project, source, task_id)

    def swap_task_id(
        self,
        project_id: str,
        source: str,
        task_id: str,
        swap_with_id: str,
    ) -> None:
        project = self._load_project(project_id)
        self.task_repository.swap_task_id(project, source, task_id, swap_with_id)

    def create_action_task(self, project_id: str) -> TaskRecord:
        return self.create_task(project_id, "action")

    def create_task(self, project_id: str, source: str) -> TaskRecord:
        project = self._load_project(project_id)
        return self.task_repository.create_task(project, source)

    def _load_project(self, project_id: str):
        project = self.project_repository.get_project(project_id)
        self.task_repository.ensure_project_files(project)
        return project
