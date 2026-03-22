from app.models import ProjectDocFile, ProjectDocSummary
from app.path_utils import resolve_user_path
from app.repositories.doc_repository import DocRepository
from app.repositories.project_repository import ProjectRepository


class DocService:
    def __init__(self, project_repository: ProjectRepository) -> None:
        self.project_repository = project_repository
        self.doc_repository = DocRepository()

    def list_docs(self, project_id: str) -> list[ProjectDocSummary]:
        project = self.project_repository.get_project(project_id)
        repository_root = resolve_user_path(project.repository_path)
        return self.doc_repository.list_docs(repository_root)

    def get_doc(self, project_id: str, doc_path: str) -> ProjectDocFile:
        project = self.project_repository.get_project(project_id)
        repository_root = resolve_user_path(project.repository_path)
        return self.doc_repository.get_doc(repository_root, doc_path)
