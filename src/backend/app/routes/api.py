from flask import Blueprint

from app.routes.docs import docs_bp
from app.routes.projects import projects_bp
from app.routes.prompts import prompts_bp
from app.routes.runner import runner_bp
from app.routes.settings import settings_bp
from app.routes.skills import skills_bp
from app.routes.tasks import tasks_bp

api_bp = Blueprint("api", __name__)

api_bp.register_blueprint(projects_bp)
api_bp.register_blueprint(settings_bp)
api_bp.register_blueprint(tasks_bp)
api_bp.register_blueprint(runner_bp)
api_bp.register_blueprint(docs_bp)
# Frontend custom prompt UI is removed, but runner/CLI still use these endpoints.
api_bp.register_blueprint(prompts_bp)
api_bp.register_blueprint(skills_bp)
