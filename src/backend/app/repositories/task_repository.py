import re
from collections.abc import Callable, MutableSequence
from datetime import date, datetime
from pathlib import Path
from typing import Final

from ruamel.yaml import YAML
from ruamel.yaml.error import YAMLError
from ruamel.yaml.scalarstring import LiteralScalarString

from app.errors import AppError
from app.models import ProjectRecord, RunnerHistoryRecord, TaskRecord

TASK_SOURCES: Final[tuple[str, ...]] = ("action", "pending", "done", "cancel", "runner")
SOURCE_FILES: Final[dict[str, str]] = {
    "action": "action.yml",
    "runner": "runner.yml",
    "pending": "pending.yml",
    "done": "done.yml",
    "cancel": "cancel.yml",
}


def normalize_project_directory_name(name: str, project_id: str) -> str:
    lowered = name.strip().lower()
    dashed = re.sub(r"\s+", "-", lowered)
    normalized = re.sub(r"[^a-z0-9._-]+", "-", dashed)
    normalized = normalized.strip("-._")
    if normalized:
        return normalized
    return f"project-{project_id}"


class TaskYamlStore:
    def __init__(self, projects_root: Path, yaml: YAML) -> None:
        self.projects_root = projects_root
        self.yaml = yaml

    def ensure_project_files(self, project: ProjectRecord) -> None:
        project_dir = self._resolve_project_dir(project)
        project_dir.mkdir(parents=True, exist_ok=True)
        for source in TASK_SOURCES:
            path = project_dir / self.source_file_name(source)
            if path.exists():
                continue
            path.write_text(self._empty_document_text(source), encoding="utf-8")

    def relocate_project_files(self, previous: ProjectRecord, current: ProjectRecord) -> None:
        previous_dir = self._resolve_project_dir(previous)
        current_dir = self._resolve_project_dir(current)
        if previous_dir == current_dir or not previous_dir.exists():
            return
        if current_dir.exists():
            raise AppError("project task directory already exists", 400)
        current_dir.parent.mkdir(parents=True, exist_ok=True)
        previous_dir.rename(current_dir)

    def load_source(self, project: ProjectRecord, source: str) -> dict:
        return self.load_yaml(self.resolve_source_path(project, source))

    def load_yaml(self, path: Path) -> dict:
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

    def write_yaml(self, path: Path, document: dict) -> None:
        with path.open("w", encoding="utf-8") as handle:
            self.yaml.dump(document, handle)

    def resolve_source_path(self, project: ProjectRecord, source: str) -> Path:
        project_dir = self._resolve_project_dir(project)
        return project_dir / self.source_file_name(source)

    def source_file_name(self, source: str) -> str:
        file_name = SOURCE_FILES.get(source)
        if file_name is None:
            raise AppError("invalid source", 400)
        return file_name

    def _resolve_project_dir(self, project: ProjectRecord) -> Path:
        root = self.projects_root.resolve()
        directory = normalize_project_directory_name(project.name, project.id)
        project_dir = (root / directory).resolve()
        if root not in project_dir.parents and project_dir != root:
            raise AppError("invalid project task directory", 400)
        return project_dir

    def _empty_document_text(self, source: str) -> str:
        if source == "runner":
            return "task: []\nhistory: []\n"
        return "task: []\n"

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


class TaskMutator:
    def get_task_items(self, document: dict) -> MutableSequence:
        tasks = document.get("task", [])
        if not isinstance(tasks, MutableSequence):
            raise AppError("task file is invalid", 400)
        return tasks

    def find_task(self, document: dict, task_id: str) -> dict:
        tasks = self.get_task_items(document)
        index = self.find_task_index(tasks, task_id)
        task = tasks[index]
        if not isinstance(task, dict):
            raise AppError("task item is invalid", 400)
        return task

    def find_task_index(self, tasks: MutableSequence, task_id: str) -> int:
        for index, item in enumerate(tasks):
            if isinstance(item, dict) and str(item.get("id", "")) == task_id:
                return index
        raise AppError("task not found", 404)

    def update_task_action(self, document: dict, task_id: str, action: str) -> dict:
        task = self.find_task(document, task_id)
        normalized = self._normalize_line_endings(action)
        task["action"] = LiteralScalarString(normalized.rstrip("\n") + "\n")
        return task

    def move_task(self, document: dict, target_document: dict, task_id: str) -> dict:
        tasks = self.get_task_items(document)
        index = self.find_task_index(tasks, task_id)
        task = tasks[index]
        if not isinstance(task, dict):
            raise AppError("task item is invalid", 400)
        del tasks[index]
        target_tasks = self.get_task_items(target_document)
        target_tasks.append(task)
        return task

    def delete_task(self, document: dict, task_id: str) -> None:
        tasks = self.get_task_items(document)
        index = self.find_task_index(tasks, task_id)
        del tasks[index]

    def swap_task_id(self, document: dict, task_id: str, swap_with_id: str) -> None:
        if task_id == swap_with_id:
            return
        task = self.find_task(document, task_id)
        swap_task = self.find_task(document, swap_with_id)
        task["id"], swap_task["id"] = swap_task.get("id"), task.get("id")

    def _normalize_line_endings(self, value: str) -> str:
        return value.replace("\r\n", "\n").replace("\r", "\n")


class RunnerHistoryParser:
    def parse(self, document: dict) -> list[RunnerHistoryRecord]:
        history_items = self._history_items(document)
        return [self._to_runner_history_record(item) for item in history_items]

    def _history_items(self, document: dict) -> MutableSequence:
        history = document.get("history", [])
        if not isinstance(history, MutableSequence):
            raise AppError("task file is invalid", 400)
        return history

    def _to_runner_history_record(self, item: object) -> RunnerHistoryRecord:
        if not isinstance(item, dict):
            raise AppError("task file is invalid", 400)
        ids = self._history_ids(item.get("id"))
        datetime_value = self._history_datetime(item.get("datetime"))
        status = item.get("status")
        if status not in {"done", "error"}:
            raise AppError("task file is invalid", 400)
        return RunnerHistoryRecord(ids=ids, datetime=datetime_value, status=status)

    def _history_datetime(self, value: object) -> str:
        if isinstance(value, str):
            normalized = value.strip()
            if normalized:
                return normalized
            raise AppError("task file is invalid", 400)
        if isinstance(value, datetime):
            return value.isoformat(sep=" ", timespec="seconds")
        if isinstance(value, date):
            return value.isoformat()
        raise AppError("task file is invalid", 400)

    def _history_ids(self, value: object) -> list[str]:
        if isinstance(value, (int, str)):
            return [str(value)]
        if not isinstance(value, MutableSequence):
            raise AppError("task file is invalid", 400)
        ids: list[str] = []
        for item in value:
            if isinstance(item, (int, str)):
                ids.append(str(item))
                continue
            raise AppError("task file is invalid", 400)
        return ids


class TaskIdAllocator:
    def create_task_id(
        self,
        project: ProjectRecord,
        source: str,
        tasks: MutableSequence,
        load_tasks_for_source: Callable[[ProjectRecord, str], MutableSequence],
    ) -> str:
        if source != "action" or len(tasks) > 0:
            return str(self._max_task_id(tasks) + 1)
        return str(self._max_other_task_id(project, source, load_tasks_for_source) + 1)

    def _max_other_task_id(
        self,
        project: ProjectRecord,
        source: str,
        load_tasks_for_source: Callable[[ProjectRecord, str], MutableSequence],
    ) -> int:
        max_id = 0
        for current_source in TASK_SOURCES:
            if current_source == source:
                continue
            tasks = load_tasks_for_source(project, current_source)
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


class TaskRepository:
    def __init__(self, projects_root: Path) -> None:
        yaml = YAML()
        yaml.preserve_quotes = True
        yaml.indent(mapping=2, sequence=4, offset=2)
        self.store = TaskYamlStore(projects_root, yaml)
        self.task_mutator = TaskMutator()
        self.history_parser = RunnerHistoryParser()
        self.id_allocator = TaskIdAllocator()

    def ensure_project_files(self, project: ProjectRecord) -> None:
        self.store.ensure_project_files(project)

    def relocate_project_files(self, previous: ProjectRecord, current: ProjectRecord) -> None:
        self.store.relocate_project_files(previous, current)

    def list_tasks(self, project: ProjectRecord) -> list[TaskRecord]:
        records: list[TaskRecord] = []
        for source in TASK_SOURCES:
            document = self.store.load_source(project, source)
            records.extend(self._to_task_records(project.id, source, document))
        return records

    def list_runner_history(self, project: ProjectRecord) -> list[RunnerHistoryRecord]:
        document = self.store.load_source(project, "runner")
        return self.history_parser.parse(document)

    def get_task(self, project: ProjectRecord, source: str, task_id: str) -> TaskRecord:
        document = self.store.load_source(project, source)
        task = self.task_mutator.find_task(document, task_id)
        return self._to_task_record(project.id, source, task)

    def update_task(
        self,
        project: ProjectRecord,
        source: str,
        task_id: str,
        action: str,
        next_source: str | None,
    ) -> TaskRecord:
        path = self.store.resolve_source_path(project, source)
        document = self.store.load_yaml(path)
        task = self.task_mutator.update_task_action(document, task_id, action)
        target_source = self._normalize_next_source(source, next_source)
        if target_source == source:
            self.store.write_yaml(path, document)
            return self._to_task_record(project.id, source, task)

        target_document = self.store.load_source(project, target_source)
        moved_task = self.task_mutator.move_task(document, target_document, task_id)
        target_path = self.store.resolve_source_path(project, target_source)
        self.store.write_yaml(target_path, target_document)
        self.store.write_yaml(path, document)
        return self._to_task_record(project.id, target_source, moved_task)

    def delete_task(self, project: ProjectRecord, source: str, task_id: str) -> None:
        path = self.store.resolve_source_path(project, source)
        document = self.store.load_yaml(path)
        self.task_mutator.delete_task(document, task_id)
        self.store.write_yaml(path, document)

    def swap_task_id(
        self,
        project: ProjectRecord,
        source: str,
        task_id: str,
        swap_with_id: str,
    ) -> None:
        path = self.store.resolve_source_path(project, source)
        document = self.store.load_yaml(path)
        self.task_mutator.swap_task_id(document, task_id, swap_with_id)
        self.store.write_yaml(path, document)

    def create_task(self, project: ProjectRecord, source: str) -> TaskRecord:
        path = self.store.resolve_source_path(project, source)
        document = self.store.load_yaml(path)
        tasks = self.task_mutator.get_task_items(document)
        task_id = self.id_allocator.create_task_id(project, source, tasks, self._load_tasks_for_source)
        task = {
            "id": task_id,
            "url": "-",
            "title": "-",
            "action": LiteralScalarString("TODO\n"),
        }
        tasks.append(task)
        self.store.write_yaml(path, document)
        return self._to_task_record(project.id, source, task)

    def _load_tasks_for_source(self, project: ProjectRecord, source: str) -> MutableSequence:
        document = self.store.load_source(project, source)
        return self.task_mutator.get_task_items(document)

    def _to_task_records(self, project_id: str, source: str, document: dict) -> list[TaskRecord]:
        tasks = self.task_mutator.get_task_items(document)
        return [self._to_task_record(project_id, source, item) for item in tasks]

    def _to_task_record(self, project_id: str, source: str, item: dict) -> TaskRecord:
        return TaskRecord(
            project_id=project_id,
            source=source,
            id=str(item.get("id", "")),
            title=str(item.get("title", "-")),
            url=str(item.get("url", "-")),
            action=str(item.get("action", "")),
        )

    def _normalize_next_source(self, source: str, next_source: str | None) -> str:
        if next_source is None:
            return source
        normalized = next_source.strip()
        if not normalized:
            raise AppError("nextSource is invalid", 400)
        self.store.source_file_name(normalized)
        return normalized
