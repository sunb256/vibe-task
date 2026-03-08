import os
from pathlib import Path

from app.errors import AppError
from app.models import ProjectRecord, SkillRecord
from app.repositories.project_repository import ProjectRepository
from app.repositories.skill_repository import SKILL_FILE_NAME, SkillRepository


class SkillService:
    def __init__(
        self,
        skill_repository: SkillRepository,
        project_repository: ProjectRepository | None = None,
    ) -> None:
        self.skill_repository = skill_repository
        self.project_repository = project_repository

    def list_skills(self) -> list[SkillRecord]:
        skills = self.skill_repository.list_skills()
        if not self.project_repository:
            return skills
        project_skills = self._list_project_skills()
        return skills + project_skills

    def get_skill(self, skill_name: str) -> SkillRecord:
        return self.skill_repository.get_skill(skill_name)

    def get_skill_by_path(self, skill_path: str) -> SkillRecord:
        path, source, project_name = self._resolve_editable_skill_path(skill_path)
        if not path.exists():
            raise AppError("skill not found", 404)
        return SkillRecord(
            name=path.parent.name,
            path=str(path),
            content=path.read_text(encoding="utf-8"),
            source=source,
            project_name=project_name,
            editable=True,
        )

    def create_skill(self, skill_name: str, content: str) -> SkillRecord:
        return self.skill_repository.create_skill(skill_name, content)

    def update_skill(self, skill_name: str, content: str) -> SkillRecord:
        return self.skill_repository.update_skill(skill_name, content)

    def update_skill_by_path(self, skill_path: str, content: str) -> SkillRecord:
        path, source, project_name = self._resolve_editable_skill_path(skill_path)
        if not path.exists():
            raise AppError("skill not found", 404)
        path.write_text(content, encoding="utf-8")
        return SkillRecord(
            name=path.parent.name,
            path=str(path),
            content=path.read_text(encoding="utf-8"),
            source=source,
            project_name=project_name,
            editable=True,
        )

    def delete_skill_by_path(self, skill_path: str) -> None:
        path, _, _ = self._resolve_editable_skill_path(skill_path)
        if not path.exists():
            raise AppError("skill not found", 404)
        path.unlink()

    def _list_project_skills(self) -> list[SkillRecord]:
        skills: list[SkillRecord] = []
        for project in self.project_repository.list_projects():
            skills.extend(self._read_project_skill_files(project))
        return skills

    def _read_project_skill_files(self, project: ProjectRecord) -> list[SkillRecord]:
        repository_path = self._resolve_repository_path(project.repository_path)
        if not repository_path.exists() or not repository_path.is_dir():
            return []
        skills: list[SkillRecord] = []
        for skills_root in self._skill_roots(repository_path):
            skills.extend(self._collect_skills_from_root(skills_root, project.name))
        return skills

    def _collect_skills_from_root(self, skills_root: Path, project_name: str) -> list[SkillRecord]:
        if not skills_root.exists() or not skills_root.is_dir():
            return []
        try:
            dirs = sorted(skills_root.iterdir(), key=lambda path: path.name.lower())
        except OSError:
            return []
        records: list[SkillRecord] = []
        for path in dirs:
            skill_file = path / SKILL_FILE_NAME
            if not path.is_dir() or not skill_file.is_file():
                continue
            records.append(
                SkillRecord(
                    name=path.name,
                    path=str(skill_file),
                    content="",
                    source="project",
                    project_name=project_name,
                    editable=True,
                )
            )
        return records

    def _resolve_repository_path(self, repository_path: str) -> Path:
        expanded = os.path.expandvars(repository_path)
        return Path(expanded).expanduser().resolve()

    def _skill_roots(self, repository_path: Path) -> tuple[Path, Path]:
        return (
            repository_path / ".codex" / "skills",
            repository_path / "skills",
        )

    def _resolve_editable_skill_path(self, skill_path: str) -> tuple[Path, str, str]:
        target = Path(skill_path).expanduser().resolve()
        if target.name != SKILL_FILE_NAME:
            raise AppError("invalid skill path", 400)

        global_root = self.skill_repository.skills_dir
        if self._is_within(global_root, target):
            return target, "global", ""

        if not self.project_repository:
            raise AppError("invalid skill path", 400)

        for project in self.project_repository.list_projects():
            repository_path = self._resolve_repository_path(project.repository_path)
            for root in self._skill_roots(repository_path):
                if self._is_within(root, target):
                    return target, "project", project.name

        raise AppError("invalid skill path", 400)

    def _is_within(self, root: Path, target: Path) -> bool:
        resolved_root = root.expanduser().resolve()
        if resolved_root == target:
            return True
        return resolved_root in target.parents
