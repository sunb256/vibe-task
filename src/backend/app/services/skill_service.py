from app.errors import AppError
from app.models import SkillRecord
from app.repositories.project_repository import ProjectRepository
from app.repositories.skill_repository import SkillRepository
from app.services.project_skill_store import ProjectSkillStore


class SkillService:
    def __init__(
        self,
        skill_repository: SkillRepository,
        project_repository: ProjectRepository | None = None,
    ) -> None:
        self.skill_repository = skill_repository
        self.project_store = (
            ProjectSkillStore(project_repository)
            if project_repository
            else None
        )

    def list_skills(self) -> list[SkillRecord]:
        skills = self.skill_repository.list_skills()
        if not self.project_store:
            return skills
        project_skills = self.project_store.list_skills()
        return skills + project_skills

    def get_skill(
        self,
        skill_name: str,
        source: str = "global",
        project_name: str = "",
    ) -> SkillRecord:
        if source == "project":
            return self._require_project_store().get_skill(project_name, skill_name)
        return self.skill_repository.get_skill(skill_name)

    def create_skill(self, skill_name: str, content: str) -> SkillRecord:
        return self.skill_repository.create_skill(skill_name, content)

    def update_skill(
        self,
        skill_name: str,
        content: str,
        source: str = "global",
        project_name: str = "",
    ) -> SkillRecord:
        if source == "project":
            store = self._require_project_store()
            return store.update_skill(project_name, skill_name, content)
        return self.skill_repository.update_skill(skill_name, content)

    def delete_skill(
        self,
        skill_name: str,
        source: str = "global",
        project_name: str = "",
    ) -> None:
        if source == "project":
            self._require_project_store().delete_skill(project_name, skill_name)
            return
        self.skill_repository.delete_skill(skill_name)

    def _require_project_store(self) -> ProjectSkillStore:
        if self.project_store:
            return self.project_store
        raise AppError("project repository is required", 500)
