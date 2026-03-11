from app.errors import AppError
from app.models import AppSettingsRecord
from app.repositories.project_repository import ProjectRepository


class AppSettingsService:
    def __init__(self, project_repository: ProjectRepository) -> None:
        self.project_repository = project_repository

    def get_settings(self) -> AppSettingsRecord:
        settings = self.project_repository.get_settings()
        return AppSettingsRecord(header_band=self._normalize_band(settings.header_band))

    def update_settings(self, payload: dict) -> AppSettingsRecord:
        return self.project_repository.update_settings(self._require_band(payload))

    def _require_band(self, payload: dict) -> str:
        value = payload.get("headerBand")
        if not isinstance(value, str) or not value.strip():
            raise AppError("invalid headerBand", 400)
        band = value.strip()
        if band not in {"zinc", "navy", "copper"}:
            raise AppError("invalid headerBand", 400)
        return band

    def _normalize_band(self, value: str) -> str:
        return value if value in {"zinc", "navy", "copper"} else "zinc"
