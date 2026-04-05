from flask import Blueprint, jsonify

from app.routes.common import prompt_repository, require_json_object, require_str_field
from app.services.prompt_service import PromptService

prompts_bp = Blueprint("prompts_api", __name__)


def _service() -> PromptService:
    return PromptService(prompt_repository())


@prompts_bp.get("/prompts")
def list_prompts():
    prompts = [
        {"name": prompt.name, "path": prompt.path}
        for prompt in _service().list_prompts()
    ]
    return jsonify({"prompts": prompts})


@prompts_bp.get("/prompts/<path:prompt_name>")
def get_prompt(prompt_name: str):
    prompt = _service().get_prompt(prompt_name)
    return jsonify(prompt.to_dict())


@prompts_bp.patch("/prompts/<path:prompt_name>")
def update_prompt(prompt_name: str):
    payload = require_json_object()
    content = require_str_field(payload, "content")
    prompt = _service().update_prompt(prompt_name, content)
    return jsonify(prompt.to_dict())


@prompts_bp.delete("/prompts/<path:prompt_name>")
def delete_prompt(prompt_name: str):
    _service().delete_prompt(prompt_name)
    return "", 204
