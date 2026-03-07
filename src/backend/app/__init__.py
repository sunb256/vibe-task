from pathlib import Path

from flask import Flask

from app.errors import register_error_handlers
from app.routes.api import api_bp


def create_app(test_config: dict[str, object] | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_mapping(PROJECTS_FILE=str(_default_projects_file()))
    if test_config:
        app.config.update(test_config)
    register_error_handlers(app)
    app.register_blueprint(api_bp, url_prefix="/api")
    return app


def _default_projects_file() -> Path:
    return Path(__file__).resolve().parents[3] / "tasks" / "projects.yml"
