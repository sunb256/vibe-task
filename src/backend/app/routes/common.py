from pathlib import Path

from flask import current_app, request

from app.errors import AppError
from app.repositories.project_repository import ProjectRepository
from app.repositories.prompt_repository import PromptRepository
from app.repositories.skill_repository import SkillRepository


def project_repository() -> ProjectRepository:
    projects_file = Path(current_app.config["PROJECTS_FILE"])
    return ProjectRepository(projects_file)


def prompt_repository() -> PromptRepository:
    prompts_dir = Path(current_app.config["PROMPTS_DIR"])
    return PromptRepository(prompts_dir)


def skill_repository() -> SkillRepository:
    skills_dir = Path(current_app.config["SKILLS_DIR"])
    return SkillRepository(skills_dir)


def require_json_object() -> dict[str, object]:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise AppError("request body must be an object", 400)
    return payload


def require_str_field(
    payload: dict[str, object],
    field_name: str,
    *,
    message: str | None = None,
) -> str:
    value = payload.get(field_name)
    if not isinstance(value, str):
        raise AppError(message or f"{field_name} is required", 400)
    return value


def require_optional_str_field(
    payload: dict[str, object],
    field_name: str,
    *,
    message: str,
) -> str | None:
    value = payload.get(field_name)
    if value is None:
        return None
    if not isinstance(value, str):
        raise AppError(message, 400)
    return value
