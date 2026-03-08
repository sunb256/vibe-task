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
def prompts_dir(tmp_path: Path) -> Path:
    prompts = tmp_path / ".codex" / "prompts"
    prompts.mkdir(parents=True)
    (prompts / "alpha.md").write_text("# Alpha\n", encoding="utf-8")
    (prompts / "beta.md").write_text("# Beta\n", encoding="utf-8")
    return prompts


@pytest.fixture()
def skills_dir(tmp_path: Path) -> Path:
    skills = tmp_path / ".codex" / "skills"
    skills.mkdir(parents=True)
    alpha = skills / "alpha"
    beta = skills / "beta"
    alpha.mkdir()
    beta.mkdir()
    (alpha / "SKILL.md").write_text("# Alpha Skill\n", encoding="utf-8")
    (beta / "SKILL.md").write_text("# Beta Skill\n", encoding="utf-8")
    return skills


@pytest.fixture()
def client(projects_file: Path, prompts_dir: Path, skills_dir: Path):
    app = create_app(
        {
            "TESTING": True,
            "PROJECTS_FILE": str(projects_file),
            "PROMPTS_DIR": str(prompts_dir),
            "SKILLS_DIR": str(skills_dir),
        }
    )
    with app.test_client() as client:
        yield client
