from pathlib import Path

from flask import Blueprint, current_app, jsonify, request

from app.errors import AppError
from app.repositories.project_repository import ProjectRepository
from app.repositories.prompt_repository import PromptRepository
from app.repositories.skill_repository import SkillRepository
from app.services.app_settings_service import AppSettingsService
from app.services.project_service import ProjectService
from app.services.prompt_service import PromptService
from app.services.skill_service import SkillService
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


@api_bp.patch("/projects/<project_id>")
def update_project(project_id: str):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise AppError("request body must be an object", 400)
    service = ProjectService(_project_repository())
    project = service.update_project(project_id, payload)
    return jsonify(project.to_dict())


@api_bp.delete("/projects/<project_id>")
def delete_project(project_id: str):
    service = ProjectService(_project_repository())
    service.delete_project(project_id)
    return "", 204


@api_bp.patch("/projects/reorder")
def reorder_projects():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise AppError("request body must be an object", 400)
    service = ProjectService(_project_repository())
    service.reorder_projects(payload)
    return "", 204


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


@api_bp.get("/settings")
def get_settings():
    service = AppSettingsService(_project_repository())
    settings = service.get_settings()
    return jsonify({"settings": settings.to_dict()})


@api_bp.patch("/settings")
def update_settings():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise AppError("request body must be an object", 400)
    service = AppSettingsService(_project_repository())
    settings = service.update_settings(payload)
    return jsonify({"settings": settings.to_dict()})


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


@api_bp.patch("/projects/<project_id>/tasks/<source>/<task_id>/swap")
def swap_task_id(project_id: str, source: str, task_id: str):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise AppError("request body must be an object", 400)
    swap_with_id = payload.get("swapWithId")
    if not isinstance(swap_with_id, str) or not swap_with_id.strip():
        raise AppError("swapWithId is required", 400)
    service = TaskService(_project_repository())
    service.swap_task_id(project_id, source, task_id, swap_with_id.strip())
    return "", 204


@api_bp.get("/prompts")
def list_prompts():
    service = PromptService(_prompt_repository())
    prompts = [
        {"name": prompt.name, "path": prompt.path}
        for prompt in service.list_prompts()
    ]
    return jsonify({"prompts": prompts})


@api_bp.get("/prompts/<path:prompt_name>")
def get_prompt(prompt_name: str):
    service = PromptService(_prompt_repository())
    prompt = service.get_prompt(prompt_name)
    return jsonify(prompt.to_dict())


@api_bp.patch("/prompts/<path:prompt_name>")
def update_prompt(prompt_name: str):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise AppError("request body must be an object", 400)
    content = payload.get("content")
    if not isinstance(content, str):
        raise AppError("content is required", 400)
    service = PromptService(_prompt_repository())
    prompt = service.update_prompt(prompt_name, content)
    return jsonify(prompt.to_dict())


@api_bp.delete("/prompts/<path:prompt_name>")
def delete_prompt(prompt_name: str):
    service = PromptService(_prompt_repository())
    service.delete_prompt(prompt_name)
    return "", 204


@api_bp.get("/skills")
def list_skills():
    service = SkillService(_skill_repository(), _project_repository())
    skills = [skill.to_summary_dict() for skill in service.list_skills()]
    return jsonify({"skills": skills})


@api_bp.get("/skills/<path:skill_name>")
def get_skill(skill_name: str):
    source, project_name = _skill_scope()
    service = SkillService(_skill_repository(), _project_repository())
    skill = service.get_skill(skill_name, source, project_name)
    return jsonify(skill.to_dict())


@api_bp.post("/skills")
def create_skill():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise AppError("request body must be an object", 400)
    name = payload.get("name")
    if not isinstance(name, str):
        raise AppError("name is required", 400)
    content = payload.get("content")
    if not isinstance(content, str):
        raise AppError("content is required", 400)
    service = SkillService(_skill_repository())
    skill = service.create_skill(name, content)
    return jsonify(skill.to_dict()), 201


@api_bp.patch("/skills/<path:skill_name>")
def update_skill(skill_name: str):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise AppError("request body must be an object", 400)
    content = payload.get("content")
    if not isinstance(content, str):
        raise AppError("content is required", 400)
    source, project_name = _skill_scope()
    service = SkillService(_skill_repository(), _project_repository())
    skill = service.update_skill(skill_name, content, source, project_name)
    return jsonify(skill.to_dict())


@api_bp.delete("/skills/<path:skill_name>")
def delete_skill(skill_name: str):
    source, project_name = _skill_scope()
    service = SkillService(_skill_repository(), _project_repository())
    service.delete_skill(skill_name, source, project_name)
    return "", 204


def _skill_scope() -> tuple[str, str]:
    source = request.args.get("source", "global").strip().lower()
    if source not in {"global", "project"}:
        raise AppError("invalid source", 400)
    project_name = request.args.get("projectName", "").strip()
    if source == "project" and not project_name:
        raise AppError("projectName is required", 400)
    return source, project_name


def _project_repository() -> ProjectRepository:
    projects_file = Path(current_app.config["PROJECTS_FILE"])
    return ProjectRepository(projects_file)


def _prompt_repository() -> PromptRepository:
    prompts_dir = Path(current_app.config["PROMPTS_DIR"])
    return PromptRepository(prompts_dir)


def _skill_repository() -> SkillRepository:
    skills_dir = Path(current_app.config["SKILLS_DIR"])
    return SkillRepository(skills_dir)
