from flask import Blueprint, jsonify

from app.routes.common import project_repository, require_json_object
from app.services.app_settings_service import AppSettingsService

settings_bp = Blueprint("settings_api", __name__)


def _service() -> AppSettingsService:
    return AppSettingsService(project_repository())


@settings_bp.get("/settings")
def get_settings():
    return jsonify(_service().get_settings().to_dict())


@settings_bp.patch("/settings")
def update_settings():
    payload = require_json_object()
    settings = _service().update_settings(payload)
    return jsonify(settings.to_dict())
