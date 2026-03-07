import re
from collections.abc import MutableSequence
from pathlib import Path

from ruamel.yaml import YAML
from ruamel.yaml.error import YAMLError
from ruamel.yaml.scalarstring import LiteralScalarString

from app.errors import AppError
from app.models import ProjectRecord, TaskRecord


class TaskRepository:
    def __init__(self) -> None:
        self.yaml = YAML()
        self.yaml.preserve_quotes = True
        self.yaml.indent(mapping=2, sequence=4, offset=2)

    def list_tasks(self, project: ProjectRecord) -> list[TaskRecord]:
        records: list[TaskRecord] = []
        for source in ("action", "done"):
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

    def update_action(
        self,
        project: ProjectRecord,
        source: str,
        task_id: str,
        action: str,
    ) -> TaskRecord:
        path = self._resolve_source_path(project, source)
        document = self._load_yaml(path)
        task = self._find_task(document, task_id)
        task["action"] = LiteralScalarString(action.rstrip("\n") + "\n")
        self._write_yaml(path, document)
        return self._to_task_record(project.id, source, task)

    def delete_task(self, project: ProjectRecord, source: str, task_id: str) -> None:
        path = self._resolve_source_path(project, source)
        document = self._load_yaml(path)
        tasks = self._get_task_items(document)
        index = self._find_task_index(tasks, task_id)
        del tasks[index]
        self._write_yaml(path, document)

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

    def _get_task_items(self, document: dict) -> MutableSequence:
        tasks = document.get("task", [])
        if not isinstance(tasks, MutableSequence):
            raise AppError("task file is invalid", 400)
        return tasks

    def _resolve_source_path(self, project: ProjectRecord, source: str) -> Path:
        relative_path = self._source_path_value(project, source)
        if Path(relative_path).is_absolute():
            raise AppError("task file path must be relative", 400)
        repo_root = Path(project.repository_path).expanduser().resolve()
        file_path = (repo_root / relative_path).resolve()
        if repo_root not in file_path.parents and file_path != repo_root:
            raise AppError("task file path must stay inside repository", 400)
        return file_path

    def _source_path_value(self, project: ProjectRecord, source: str) -> str:
        if source == "action":
            return project.action_list_path
        if source == "done":
            return project.done_list_path
        raise AppError("invalid source", 400)

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
