from pathlib import Path

from app.errors import AppError
from app.models import SkillRecord

SKILL_FILE_NAME = "SKILL.md"


class SkillRepository:
    def __init__(self, skills_dir: Path) -> None:
        self.skills_dir = skills_dir.expanduser().resolve()

    def list_skills(self) -> list[SkillRecord]:
        if not self.skills_dir.exists():
            return []
        dirs = [path for path in self.skills_dir.iterdir() if path.is_dir()]
        records = [
            self._to_skill_summary(path)
            for path in sorted(dirs, key=lambda value: value.name.lower())
            if (path / SKILL_FILE_NAME).is_file()
        ]
        return records

    def get_skill(self, skill_name: str) -> SkillRecord:
        skill_path = self._resolve_skill_file_path(skill_name)
        if not skill_path.exists():
            raise AppError("skill not found", 404)
        return self._to_skill_record(skill_path)

    def create_skill(self, skill_name: str, content: str) -> SkillRecord:
        skill_path = self._resolve_skill_file_path(skill_name)
        if skill_path.exists():
            raise AppError("skill already exists", 409)
        skill_path.parent.mkdir(parents=True, exist_ok=True)
        skill_path.write_text(content, encoding="utf-8")
        return self._to_skill_record(skill_path)

    def update_skill(self, skill_name: str, content: str) -> SkillRecord:
        skill_path = self._resolve_skill_file_path(skill_name)
        if not skill_path.exists():
            raise AppError("skill not found", 404)
        skill_path.write_text(content, encoding="utf-8")
        return self._to_skill_record(skill_path)

    def delete_skill(self, skill_name: str) -> None:
        skill_path = self._resolve_skill_file_path(skill_name)
        if not skill_path.exists():
            raise AppError("skill not found", 404)
        skill_path.unlink()
        try:
            skill_path.parent.rmdir()
        except OSError:
            return

    def _to_skill_record(self, path: Path) -> SkillRecord:
        return SkillRecord(
            name=path.parent.name,
            path=str(path),
            content=path.read_text(encoding="utf-8"),
        )

    def _to_skill_summary(self, path: Path) -> SkillRecord:
        return SkillRecord(name=path.name, path=str(path / SKILL_FILE_NAME), content="")

    def _resolve_skill_file_path(self, skill_name: str) -> Path:
        name = skill_name.strip()
        if not name:
            raise AppError("skill name is required", 400)
        if "/" in name or "\\" in name:
            raise AppError("invalid skill name", 400)
        dir_path = (self.skills_dir / name).resolve()
        if self.skills_dir != dir_path and self.skills_dir not in dir_path.parents:
            raise AppError("skill path must stay inside skills directory", 400)
        return dir_path / SKILL_FILE_NAME
