from pathlib import Path

from app.errors import AppError
from app.models import PromptRecord


class PromptRepository:
    def __init__(self, prompts_dir: Path) -> None:
        self.prompts_dir = prompts_dir.expanduser().resolve()

    def list_prompts(self) -> list[PromptRecord]:
        if not self.prompts_dir.exists():
            return []
        files = self._list_prompt_files()
        return [self._to_prompt_record(path) for path in files]

    def get_prompt(self, prompt_name: str) -> PromptRecord:
        path = self._resolve_prompt_path(prompt_name)
        if not path.exists():
            raise AppError("prompt not found", 404)
        return self._to_prompt_record(path)

    def update_prompt(self, prompt_name: str, content: str) -> PromptRecord:
        path = self._resolve_prompt_path(prompt_name)
        if not path.exists():
            raise AppError("prompt not found", 404)
        path.write_text(content, encoding="utf-8")
        return self._to_prompt_record(path)

    def delete_prompt(self, prompt_name: str) -> None:
        path = self._resolve_prompt_path(prompt_name)
        if not path.exists():
            raise AppError("prompt not found", 404)
        path.unlink()

    def _list_prompt_files(self) -> list[Path]:
        files = (path for path in self.prompts_dir.glob("*.md") if path.is_file())
        return sorted(files, key=lambda path: path.name.lower())

    def _to_prompt_record(self, path: Path) -> PromptRecord:
        return PromptRecord(
            name=path.name,
            path=str(path),
            content=path.read_text(encoding="utf-8"),
        )

    def _resolve_prompt_path(self, prompt_name: str) -> Path:
        name = prompt_name.strip()
        if not name:
            raise AppError("prompt name is required", 400)
        if "/" in name or "\\" in name:
            raise AppError("invalid prompt name", 400)
        if not name.endswith(".md"):
            raise AppError("prompt file must be .md", 400)
        path = (self.prompts_dir / name).resolve()
        if self.prompts_dir not in path.parents:
            raise AppError("prompt file path must stay inside prompts directory", 400)
        return path
