from pathlib import Path

from flask import Blueprint, current_app, jsonify, request

from app.errors import AppError
from app.repositories.project_repository import ProjectRepository
from app.services.project_service import ProjectService
from app.services.task_service import TaskService

api_bp = Blueprint("api", __name__)


@api_bp.get("/projects")
def list_projects():
    service = ProjectService(_project_repository())
    projects = [project.to_dict() for project in service.list_projects()]
    return jsonify({"projects": projects})


@api_bp.post("/projects")
def create_project():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise AppError("request body must be an object", 400)
    service = ProjectService(_project_repository())
    project = service.create_project(payload)
    return jsonify(project.to_dict()), 201


@api_bp.get("/projects/export")
def export_projects():
    service = ProjectService(_project_repository())
    content = service.export_projects_text()
    return jsonify({"content": content})


@api_bp.post("/projects/import")
def import_projects():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise AppError("request body must be an object", 400)
    content = payload.get("content")
    if not isinstance(content, str):
        raise AppError("content is required", 400)
    service = ProjectService(_project_repository())
    service.import_projects_text(content)
    return "", 204


@api_bp.get("/projects/<project_id>/tasks")
def list_tasks(project_id: str):
    service = TaskService(_project_repository())
    tasks = [task.to_dict() for task in service.list_tasks(project_id)]
    return jsonify({"tasks": tasks})


@api_bp.post("/projects/<project_id>/tasks/action")
def create_action_task(project_id: str):
    service = TaskService(_project_repository())
    task = service.create_action_task(project_id)
    return jsonify(task.to_dict()), 201


@api_bp.get("/projects/<project_id>/tasks/<source>/<task_id>")
def get_task(project_id: str, source: str, task_id: str):
    service = TaskService(_project_repository())
    task = service.get_task(project_id, source, task_id)
    return jsonify(task.to_dict())


@api_bp.patch("/projects/<project_id>/tasks/<source>/<task_id>")
def update_task(project_id: str, source: str, task_id: str):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise AppError("request body must be an object", 400)
    action = payload.get("action")
    if not isinstance(action, str):
        raise AppError("action is required", 400)
    service = TaskService(_project_repository())
    task = service.update_action(project_id, source, task_id, action)
    return jsonify(task.to_dict())


@api_bp.delete("/projects/<project_id>/tasks/<source>/<task_id>")
def delete_task(project_id: str, source: str, task_id: str):
    service = TaskService(_project_repository())
    service.delete_task(project_id, source, task_id)
    return "", 204


def _project_repository() -> ProjectRepository:
    projects_file = Path(current_app.config["PROJECTS_FILE"])
    return ProjectRepository(projects_file)
