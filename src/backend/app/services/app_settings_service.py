import re

from app.errors import AppError
from app.models import AppSettingsRecord
from app.repositories.project_repository import ProjectRepository

HEADER_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class AppSettingsService:
    def __init__(self, project_repository: ProjectRepository) -> None:
        self.project_repository = project_repository

    def get_settings(self) -> AppSettingsRecord:
        return self.project_repository.get_app_settings()

    def update_settings(self, payload: dict) -> AppSettingsRecord:
        header_color = self._require_header_color(payload)
        return self.project_repository.update_app_settings(header_color)

    def _require_header_color(self, payload: dict) -> str:
        header_color = payload.get("headerColor")
        if not isinstance(header_color, str) or not HEADER_COLOR_RE.fullmatch(header_color):
            raise AppError("headerColor must be a hex color", 400)
        return header_color.lower()
