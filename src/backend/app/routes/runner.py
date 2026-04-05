from flask import Blueprint, jsonify, request

from app.errors import AppError
from app.routes.common import project_repository
from app.services.runner_service import RunnerService

runner_bp = Blueprint("runner_api", __name__)


def _service() -> RunnerService:
    return RunnerService(project_repository())


@runner_bp.post("/projects/<project_id>/runner/execute")
def execute_runner(project_id: str):
    _service().execute_runner(project_id)
    return jsonify({"running": True}), 202


@runner_bp.post("/projects/<project_id>/runner/cancel")
def cancel_runner(project_id: str):
    _service().cancel_runner(project_id)
    return jsonify({"running": False}), 202


@runner_bp.get("/projects/<project_id>/runner/logs")
def get_runner_logs(project_id: str):
    lines = _parse_runner_log_lines(request.args.get("lines"))
    payload = _service().read_runner_logs(project_id, lines)
    return jsonify(payload.to_dict())


def _parse_runner_log_lines(raw_value: str | None) -> int:
    if raw_value is None or not raw_value.strip():
        return 200
    value = raw_value.strip()
    if not value.isdigit():
        raise AppError("lines must be an integer", 400)
    lines = int(value)
    if lines <= 0 or lines > 2000:
        raise AppError("lines must be between 1 and 2000", 400)
    return lines
