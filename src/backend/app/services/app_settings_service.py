from app.errors import AppError
from app.models import AppSettingsRecord
from app.repositories.project_repository import ProjectRepository


class AppSettingsService:
    valid_bands = {"zinc", "navy", "copper", "forest", "plum", "charcoal", "custom"}

    def __init__(self, project_repository: ProjectRepository) -> None:
        self.project_repository = project_repository

    def get_settings(self) -> AppSettingsRecord:
        settings = self.project_repository.get_settings()
        return AppSettingsRecord(
            header_band=self._normalize_band(settings.header_band),
            custom_header_color=self._normalize_color(settings.custom_header_color),
        )

    def update_settings(self, payload: dict) -> AppSettingsRecord:
        band = self._require_band(payload)
        color = self._require_color(payload, band)
        return self.project_repository.update_settings(band, color)

    def _require_band(self, payload: dict) -> str:
        value = payload.get("headerBand")
        if not isinstance(value, str) or not value.strip():
            raise AppError("invalid headerBand", 400)
        band = value.strip()
        if band not in self.valid_bands:
            raise AppError("invalid headerBand", 400)
        return band

    def _require_color(self, payload: dict, band: str) -> str:
        value = payload.get("customHeaderColor", "")
        if not isinstance(value, str):
            raise AppError("invalid customHeaderColor", 400)
        color = self._normalize_color(value)
        if band == "custom" and not color:
            raise AppError("invalid customHeaderColor", 400)
        return color

    def _normalize_band(self, value: str) -> str:
        return value if value in self.valid_bands else "zinc"

    def _normalize_color(self, value: str) -> str:
        color = value.strip().lower()
        if not color:
            return ""
        if len(color) != 7 or not color.startswith("#"):
            return ""
        digits = color[1:]
        if not all(char in "0123456789abcdef" for char in digits):
            return ""
        return color
