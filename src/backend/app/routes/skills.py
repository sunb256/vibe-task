from flask import Blueprint, jsonify, request

from app.errors import AppError
from app.routes.common import (
    project_repository,
    require_json_object,
    require_str_field,
    skill_repository,
)
from app.services.skill_service import SkillService

skills_bp = Blueprint("skills_api", __name__)


@skills_bp.get("/skills")
def list_skills():
    service = SkillService(skill_repository(), project_repository())
    skills = [skill.to_summary_dict() for skill in service.list_skills()]
    return jsonify({"skills": skills})


@skills_bp.get("/skills/<path:skill_name>")
def get_skill(skill_name: str):
    source, project_name = _skill_scope()
    service = SkillService(skill_repository(), project_repository())
    skill = service.get_skill(skill_name, source, project_name)
    return jsonify(skill.to_dict())


@skills_bp.post("/skills")
def create_skill():
    payload = require_json_object()
    name = require_str_field(payload, "name")
    content = require_str_field(payload, "content")
    service = SkillService(skill_repository())
    skill = service.create_skill(name, content)
    return jsonify(skill.to_dict()), 201


@skills_bp.patch("/skills/<path:skill_name>")
def update_skill(skill_name: str):
    payload = require_json_object()
    content = require_str_field(payload, "content")
    source, project_name = _skill_scope()
    service = SkillService(skill_repository(), project_repository())
    skill = service.update_skill(skill_name, content, source, project_name)
    return jsonify(skill.to_dict())


@skills_bp.delete("/skills/<path:skill_name>")
def delete_skill(skill_name: str):
    source, project_name = _skill_scope()
    service = SkillService(skill_repository(), project_repository())
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
