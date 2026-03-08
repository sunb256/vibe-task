from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class ProjectRecord:
    id: str
    name: str
    repository_path: str

    def to_dict(self) -> dict[str, str | bool]:
        return {
            "id": self.id,
            "name": self.name,
            "repositoryPath": self.repository_path,
        }


@dataclass(slots=True)
class TaskRecord:
    project_id: str
    source: str
    id: str
    title: str
    url: str
    action: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "projectId": self.project_id,
            "source": self.source,
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "action": self.action,
        }


@dataclass(slots=True)
class PromptRecord:
    name: str
    path: str
    content: str

    def to_dict(self) -> dict[str, str]:
        return {
            "name": self.name,
            "path": self.path,
            "content": self.content,
        }


@dataclass(slots=True)
class SkillRecord:
    name: str
    path: str
    content: str
    source: str = "global"
    project_name: str = ""
    editable: bool = True

    def to_dict(self) -> dict[str, str]:
        return {
            "name": self.name,
            "path": self.path,
            "content": self.content,
            "source": self.source,
            "projectName": self.project_name,
            "editable": self.editable,
        }

    def to_summary_dict(self) -> dict[str, str | bool]:
        return {
            "name": self.name,
            "path": self.path,
            "source": self.source,
            "projectName": self.project_name,
            "editable": self.editable,
        }
