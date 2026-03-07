from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class ProjectRecord:
    id: str
    name: str
    repository_path: str
    action_list_path: str
    done_list_path: str

    def to_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "name": self.name,
            "repositoryPath": self.repository_path,
            "actionListPath": self.action_list_path,
            "doneListPath": self.done_list_path,
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
