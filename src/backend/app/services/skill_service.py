from app.models import SkillRecord
from app.repositories.skill_repository import SkillRepository


class SkillService:
    def __init__(self, skill_repository: SkillRepository) -> None:
        self.skill_repository = skill_repository

    def list_skills(self) -> list[SkillRecord]:
        return self.skill_repository.list_skills()

    def get_skill(self, skill_name: str) -> SkillRecord:
        return self.skill_repository.get_skill(skill_name)

    def create_skill(self, skill_name: str, content: str) -> SkillRecord:
        return self.skill_repository.create_skill(skill_name, content)

    def update_skill(self, skill_name: str, content: str) -> SkillRecord:
        return self.skill_repository.update_skill(skill_name, content)
