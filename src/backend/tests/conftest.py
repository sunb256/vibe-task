import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app


@pytest.fixture()
def project_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "sample-repo"
    tasks_dir = repo / "tasks"
    tasks_dir.mkdir(parents=True)
    (tasks_dir / "action.yml").write_text(
        "impl_rule: |\n  sample\n\ntask:\n  - id: 1\n    url: -\n    title: -\n    action: |\n      first task\n",
        encoding="utf-8",
    )
    (tasks_dir / "done.yml").write_text(
        "task:\n  - id: 2\n    url: done-url\n    title: done-title\n    action: |\n      done task\n",
        encoding="utf-8",
    )
    return repo


@pytest.fixture()
def projects_file(tmp_path: Path) -> Path:
    return tmp_path / "projects.yml"


@pytest.fixture()
def client(projects_file: Path):
    app = create_app({"TESTING": True, "PROJECTS_FILE": str(projects_file)})
    with app.test_client() as client:
        yield client
