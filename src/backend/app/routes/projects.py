from flask import Blueprint, jsonify

from app.routes.common import project_repository, require_json_object, require_str_field
from app.services.project_service import ProjectService

projects_bp = Blueprint("projects_api", __name__)


def _service() -> ProjectService:
    return ProjectService(project_repository())


@projects_bp.get("/projects")
def list_projects():
    projects = [project.to_dict() for project in _service().list_projects()]
    return jsonify({"projects": projects})


@projects_bp.post("/projects")
def create_project():
    payload = require_json_object()
    project = _service().create_project(payload)
    return jsonify(project.to_dict()), 201


@projects_bp.patch("/projects/<project_id>")
def update_project(project_id: str):
    payload = require_json_object()
    project = _service().update_project(project_id, payload)
    return jsonify(project.to_dict())


@projects_bp.delete("/projects/<project_id>")
def delete_project(project_id: str):
    _service().delete_project(project_id)
    return "", 204


@projects_bp.patch("/projects/reorder")
def reorder_projects():
    payload = require_json_object()
    _service().reorder_projects(payload)
    return "", 204


@projects_bp.get("/projects/export")
def export_projects():
    content = _service().export_projects_text()
    return jsonify({"content": content})


@projects_bp.post("/projects/import")
def import_projects():
    payload = require_json_object()
    content = require_str_field(payload, "content")
    _service().import_projects_text(content)
    return "", 204
