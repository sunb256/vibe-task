from app.models import TaskRecord
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository


class TaskService:
    def __init__(self, project_repository: ProjectRepository) -> None:
        self.project_repository = project_repository
        self.task_repository = TaskRepository()

    def list_tasks(self, project_id: str) -> list[TaskRecord]:
        project = self.project_repository.get_project(project_id)
        return self.task_repository.list_tasks(project)

    def get_task(self, project_id: str, source: str, task_id: str) -> TaskRecord:
        project = self.project_repository.get_project(project_id)
        return self.task_repository.get_task(project, source, task_id)

    def update_action(
        self,
        project_id: str,
        source: str,
        task_id: str,
        action: str,
    ) -> TaskRecord:
        project = self.project_repository.get_project(project_id)
        return self.task_repository.update_action(project, source, task_id, action)

    def delete_task(self, project_id: str, source: str, task_id: str) -> None:
        project = self.project_repository.get_project(project_id)
        self.task_repository.delete_task(project, source, task_id)

    def create_action_task(self, project_id: str) -> TaskRecord:
        project = self.project_repository.get_project(project_id)
        return self.task_repository.create_task(project, "action")
