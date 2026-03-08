import os
from pathlib import Path

from app.errors import AppError
from app.models import ProjectRecord, SkillRecord
from app.repositories.project_repository import ProjectRepository
from app.repositories.skill_repository import SKILL_FILE_NAME


class ProjectSkillStore:
    def __init__(self, project_repository: ProjectRepository) -> None:
        self.project_repository = project_repository

    def list_skills(self) -> list[SkillRecord]:
        records: list[SkillRecord] = []
        for project in self.project_repository.list_projects():
            records.extend(self._read_project_skill_files(project))
        return records

    def get_skill(self, project_name: str, skill_name: str) -> SkillRecord:
        path = self._project_skill_path(project_name, skill_name)
        return self._to_project_skill(path, project_name)

    def update_skill(
        self,
        project_name: str,
        skill_name: str,
        content: str,
    ) -> SkillRecord:
        path = self._project_skill_path(project_name, skill_name)
        path.write_text(content, encoding="utf-8")
        return self._to_project_skill(path, project_name)

    def delete_skill(self, project_name: str, skill_name: str) -> None:
        path = self._project_skill_path(project_name, skill_name)
        path.unlink()
        try:
            path.parent.rmdir()
        except OSError:
            return

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
            records.append(self._to_project_skill(skill_file, project_name))
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
