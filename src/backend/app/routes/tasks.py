from flask import Blueprint, jsonify

from app.errors import AppError
from app.routes.common import (
    project_repository,
    require_json_object,
    require_optional_str_field,
    require_str_field,
)
from app.services.task_service import TaskService

tasks_bp = Blueprint("tasks_api", __name__)


def _service() -> TaskService:
    return TaskService(project_repository())


@tasks_bp.get("/projects/<project_id>/tasks")
def list_tasks(project_id: str):
    service = _service()
    tasks = [task.to_dict() for task in service.list_tasks(project_id)]
    runner_history = [item.to_dict() for item in service.list_runner_history(project_id)]
    return jsonify({"tasks": tasks, "runnerHistory": runner_history})


@tasks_bp.post("/projects/<project_id>/tasks/<source>")
def create_task(project_id: str, source: str):
    task = _service().create_task(project_id, source)
    return jsonify(task.to_dict()), 201


@tasks_bp.get("/projects/<project_id>/tasks/<source>/<task_id>")
def get_task(project_id: str, source: str, task_id: str):
    task = _service().get_task(project_id, source, task_id)
    return jsonify(task.to_dict())


@tasks_bp.patch("/projects/<project_id>/tasks/<source>/<task_id>")
def update_task(project_id: str, source: str, task_id: str):
    payload = require_json_object()
    action = require_str_field(payload, "action")
    next_source = require_optional_str_field(
        payload,
        "nextSource",
        message="nextSource must be a string",
    )
    task = _service().update_task(project_id, source, task_id, action, next_source)
    return jsonify(task.to_dict())


@tasks_bp.delete("/projects/<project_id>/tasks/<source>/<task_id>")
def delete_task(project_id: str, source: str, task_id: str):
    _service().delete_task(project_id, source, task_id)
    return "", 204


@tasks_bp.patch("/projects/<project_id>/tasks/<source>/<task_id>/swap")
def swap_task_id(project_id: str, source: str, task_id: str):
    payload = require_json_object()
    swap_with_id = require_str_field(payload, "swapWithId")
    trimmed_swap_with_id = swap_with_id.strip()
    if not trimmed_swap_with_id:
        raise AppError("swapWithId is required", 400)
    _service().swap_task_id(project_id, source, task_id, trimmed_swap_with_id)
    return "", 204
