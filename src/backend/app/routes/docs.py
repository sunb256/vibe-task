from flask import Blueprint, jsonify

from app.routes.common import project_repository
from app.services.doc_service import DocService

docs_bp = Blueprint("docs_api", __name__)


def _service() -> DocService:
    return DocService(project_repository())


@docs_bp.get("/projects/<project_id>/docs")
def list_project_docs(project_id: str):
    docs = [item.to_dict() for item in _service().list_docs(project_id)]
    return jsonify({"docs": docs})


@docs_bp.get("/projects/<project_id>/docs/<path:doc_path>")
def get_project_doc(project_id: str, doc_path: str):
    doc = _service().get_doc(project_id, doc_path)
    return jsonify(doc.to_dict())
