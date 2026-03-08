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

    def get_skill(
        self,
        skill_name: str,
        source: str = "global",
        project_name: str = "",
    ) -> SkillRecord:
        if source == "project":
            path = self._project_skill_path(project_name, skill_name)
            return self._to_project_skill(path, project_name)
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
            path = self._project_skill_path(project_name, skill_name)
            path.write_text(content, encoding="utf-8")
            return self._to_project_skill(path, project_name)
        return self.skill_repository.update_skill(skill_name, content)

    def delete_skill(
        self,
        skill_name: str,
        source: str = "global",
        project_name: str = "",
    ) -> None:
        if source == "project":
            path = self._project_skill_path(project_name, skill_name)
            path.unlink()
            try:
                path.parent.rmdir()
            except OSError:
                return
            return
        self.skill_repository.delete_skill(skill_name)

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

    def _project_skill_path(self, project_name: str, skill_name: str) -> Path:
        project = self._find_project(project_name)
        name = self._normalize_skill_name(skill_name)
        repository_path = self._resolve_repository_path(project.repository_path)
        for skills_root in self._skill_roots(repository_path):
            skill_file = skills_root / name / SKILL_FILE_NAME
            if skill_file.is_file():
                return skill_file
        raise AppError("skill not found", 404)

    def _find_project(self, project_name: str) -> ProjectRecord:
        if not self.project_repository:
            raise AppError("project repository is required", 500)
        name = project_name.strip()
        if not name:
            raise AppError("projectName is required", 400)
        for project in self.project_repository.list_projects():
            if project.name == name:
                return project
        raise AppError("project not found", 404)

    def _normalize_skill_name(self, skill_name: str) -> str:
        name = skill_name.strip()
        if not name:
            raise AppError("skill name is required", 400)
        if "/" in name or "\\" in name:
            raise AppError("invalid skill name", 400)
        return name

    def _to_project_skill(self, path: Path, project_name: str) -> SkillRecord:
        return SkillRecord(
            name=path.parent.name,
            path=str(path),
            content=path.read_text(encoding="utf-8"),
            source="project",
            project_name=project_name,
            editable=True,
        )

    def _resolve_repository_path(self, repository_path: str) -> Path:
        expanded = os.path.expandvars(repository_path)
        return Path(expanded).expanduser().resolve()

    def _skill_roots(self, repository_path: Path) -> tuple[Path, Path]:
        return (
            repository_path / ".codex" / "skills",
            repository_path / "skills",
        )
