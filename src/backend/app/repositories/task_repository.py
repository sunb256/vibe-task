import re
from collections.abc import MutableSequence
from pathlib import Path
from typing import Final

from ruamel.yaml import YAML
from ruamel.yaml.error import YAMLError
from ruamel.yaml.scalarstring import LiteralScalarString

from app.errors import AppError
from app.models import ProjectRecord, TaskRecord

TASK_SOURCES: Final[tuple[str, ...]] = ("action", "pending", "done", "cancel")
SOURCE_FILES: Final[dict[str, str]] = {
    "action": "action.yml",
    "pending": "pending.yml",
    "done": "done.yml",
    "cancel": "cancel.yml",
}


class TaskRepository:
    def __init__(self, projects_root: Path) -> None:
        self.projects_root = projects_root
        self.yaml = YAML()
        self.yaml.preserve_quotes = True
        self.yaml.indent(mapping=2, sequence=4, offset=2)

    def ensure_project_files(self, project: ProjectRecord) -> None:
        project_dir = self._resolve_project_dir(project)
        project_dir.mkdir(parents=True, exist_ok=True)
        for source in TASK_SOURCES:
            path = project_dir / self._source_file_name(source)
            if path.exists():
                continue
            path.write_text("task: []\n", encoding="utf-8")

    def relocate_project_files(
        self,
        previous: ProjectRecord,
        current: ProjectRecord,
    ) -> None:
        previous_dir = self._resolve_project_dir(previous)
        current_dir = self._resolve_project_dir(current)
        if previous_dir == current_dir or not previous_dir.exists():
            return
        if current_dir.exists():
            raise AppError("project task directory already exists", 400)
        current_dir.parent.mkdir(parents=True, exist_ok=True)
        previous_dir.rename(current_dir)

    def list_tasks(self, project: ProjectRecord) -> list[TaskRecord]:
        records: list[TaskRecord] = []
        for source in TASK_SOURCES:
            document = self._load_source(project, source)
            records.extend(self._to_task_records(project.id, source, document))
        return records

    def get_task(
        self,
        project: ProjectRecord,
        source: str,
        task_id: str,
    ) -> TaskRecord:
        document = self._load_source(project, source)
        task = self._find_task(document, task_id)
        return self._to_task_record(project.id, source, task)

    def update_task(
        self,
        project: ProjectRecord,
        source: str,
        task_id: str,
        action: str,
        next_source: str | None,
    ) -> TaskRecord:
        path = self._resolve_source_path(project, source)
        document = self._load_yaml(path)
        task = self._update_task_action(document, task_id, action)
        target_source = self._normalize_next_source(source, next_source)
        if target_source == source:
            self._write_yaml(path, document)
            return self._to_task_record(project.id, source, task)
        target_document = self._load_source(project, target_source)
        moved_task = self._move_task(document, target_document, task_id)
        self._write_yaml(self._resolve_source_path(project, target_source), target_document)
        self._write_yaml(path, document)
        return self._to_task_record(project.id, target_source, moved_task)

    def delete_task(self, project: ProjectRecord, source: str, task_id: str) -> None:
        path = self._resolve_source_path(project, source)
        document = self._load_yaml(path)
        tasks = self._get_task_items(document)
        index = self._find_task_index(tasks, task_id)
        del tasks[index]
        self._write_yaml(path, document)

    def swap_task_id(
        self,
        project: ProjectRecord,
        source: str,
        task_id: str,
        swap_with_id: str,
    ) -> None:
        if task_id == swap_with_id:
            return
        path = self._resolve_source_path(project, source)
        document = self._load_yaml(path)
        task = self._find_task(document, task_id)
        swap_task = self._find_task(document, swap_with_id)
        task["id"], swap_task["id"] = swap_task.get("id"), task.get("id")
        self._write_yaml(path, document)

    def create_task(self, project: ProjectRecord, source: str) -> TaskRecord:
        path = self._resolve_source_path(project, source)
        document = self._load_yaml(path)
        tasks = self._get_task_items(document)
        task_id = self._create_task_id(project, source, tasks)
        task = {
            "id": task_id,
            "url": "-",
            "title": "-",
            "action": LiteralScalarString("TODO\n"),
        }
        tasks.append(task)
        self._write_yaml(path, document)
        return self._to_task_record(project.id, source, task)

    def _create_task_id(
        self,
        project: ProjectRecord,
        source: str,
        tasks: MutableSequence,
    ) -> str:
        if source != "action" or len(tasks) > 0:
            return self._next_task_id(tasks)
        return str(self._max_other_task_id(project, source) + 1)

    def _to_task_records(
        self,
        project_id: str,
        source: str,
        document: dict,
    ) -> list[TaskRecord]:
        tasks = self._get_task_items(document)
        return [self._to_task_record(project_id, source, item) for item in tasks]

    def _to_task_record(
        self,
        project_id: str,
        source: str,
        item: dict,
    ) -> TaskRecord:
        return TaskRecord(
            project_id=project_id,
            source=source,
            id=str(item.get("id", "")),
            title=str(item.get("title", "-")),
            url=str(item.get("url", "-")),
            action=str(item.get("action", "")),
        )

    def _load_source(self, project: ProjectRecord, source: str) -> dict:
        path = self._resolve_source_path(project, source)
        return self._load_yaml(path)

    def _update_task_action(
        self,
        document: dict,
        task_id: str,
        action: str,
    ) -> dict:
        task = self._find_task(document, task_id)
        task["action"] = LiteralScalarString(action.rstrip("\n") + "\n")
        return task

    def _normalize_next_source(self, source: str, next_source: str | None) -> str:
        if next_source is None:
            return source
        normalized = next_source.strip()
        if not normalized:
            raise AppError("nextSource is invalid", 400)
        self._source_file_name(normalized)
        return normalized

    def _move_task(
        self,
        document: dict,
        target_document: dict,
        task_id: str,
    ) -> dict:
        tasks = self._get_task_items(document)
        index = self._find_task_index(tasks, task_id)
        task = tasks[index]
        if not isinstance(task, dict):
            raise AppError("task item is invalid", 400)
        del tasks[index]
        target_tasks = self._get_task_items(target_document)
        target_tasks.append(task)
        return task

    def _load_yaml(self, path: Path) -> dict:
        if not path.exists():
            raise AppError(f"task file not found: {path}", 400)
        raw_text = path.read_text(encoding="utf-8")
        normalized = self._normalize_dash_placeholders(raw_text)
        try:
            document = self.yaml.load(normalized) or {}
        except YAMLError as error:
            raise AppError(f"task file is invalid: {path}", 400) from error
        if not isinstance(document, dict):
            raise AppError(f"task file is invalid: {path}", 400)
        document.setdefault("task", [])
        return document

    def _write_yaml(self, path: Path, document: dict) -> None:
        with path.open("w", encoding="utf-8") as handle:
            self.yaml.dump(document, handle)

    def _find_task(self, document: dict, task_id: str) -> dict:
        tasks = self._get_task_items(document)
        index = self._find_task_index(tasks, task_id)
        task = tasks[index]
        if not isinstance(task, dict):
            raise AppError("task item is invalid", 400)
        return task

    def _find_task_index(self, tasks: MutableSequence, task_id: str) -> int:
        for index, item in enumerate(tasks):
            if isinstance(item, dict) and str(item.get("id", "")) == task_id:
                return index
        raise AppError("task not found", 404)

    def _next_task_id(self, tasks: MutableSequence) -> str:
        return str(self._max_task_id(tasks) + 1)

    def _max_other_task_id(self, project: ProjectRecord, source: str) -> int:
        max_id = 0
        for current_source in TASK_SOURCES:
            if current_source == source:
                continue
            document = self._load_source(project, current_source)
            tasks = self._get_task_items(document)
            max_id = max(max_id, self._max_task_id(tasks))
        return max_id

    def _max_task_id(self, tasks: MutableSequence) -> int:
        max_id = 0
        for item in tasks:
            if not isinstance(item, dict):
                continue
            value = item.get("id")
            if isinstance(value, int):
                max_id = max(max_id, value)
                continue
            if isinstance(value, str) and value.isdigit():
                max_id = max(max_id, int(value))
        return max_id

    def _get_task_items(self, document: dict) -> MutableSequence:
        tasks = document.get("task", [])
        if not isinstance(tasks, MutableSequence):
            raise AppError("task file is invalid", 400)
        return tasks

    def _resolve_source_path(self, project: ProjectRecord, source: str) -> Path:
        project_dir = self._resolve_project_dir(project)
        return project_dir / self._source_file_name(source)

    def _source_file_name(self, source: str) -> str:
        file_name = SOURCE_FILES.get(source)
        if file_name is None:
            raise AppError("invalid source", 400)
        return file_name

    def _resolve_project_dir(self, project: ProjectRecord) -> Path:
        root = self.projects_root.resolve()
        directory = self._project_directory_name(project.name, project.id)
        project_dir = (root / directory).resolve()
        if root not in project_dir.parents and project_dir != root:
            raise AppError("invalid project task directory", 400)
        return project_dir

    def _project_directory_name(self, name: str, project_id: str) -> str:
        lowered = name.strip().lower()
        dashed = re.sub(r"\s+", "-", lowered)
        normalized = re.sub(r"[^a-z0-9._-]+", "-", dashed)
        normalized = normalized.strip("-._")
        if normalized:
            return normalized
        return f"project-{project_id}"

    def _normalize_dash_placeholders(self, raw_text: str) -> str:
        normalized: list[str] = []
        block_indent: int | None = None
        pattern = re.compile(r"(:\s)-(\s*(?:#.*)?$)")

        for line in raw_text.splitlines():
            indent = len(line) - len(line.lstrip(" "))
            stripped = line.strip()
            if block_indent is not None and stripped and indent <= block_indent:
                block_indent = None
            if block_indent is None and stripped.endswith("|"):
                block_indent = indent
            if block_indent is None:
                line = pattern.sub(r'\1"-"\2', line)
            normalized.append(line)

        return "\n".join(normalized)
