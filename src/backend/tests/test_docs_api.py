import subprocess
from pathlib import Path


def create_project(client, project_repo: Path, project_name: str = "impl") -> str:
    created = client.post(
        "/api/projects",
        json={
            "name": project_name,
            "repositoryPath": str(project_repo),
        },
    )
    assert created.status_code == 201
    return created.get_json()["id"]


def init_git_repo(path: Path) -> None:
    subprocess.run(["git", "init"], cwd=path, check=True, capture_output=True)


def test_lists_markdown_docs_and_applies_gitignore(client, project_repo: Path):
    (project_repo / "README.md").write_text("# README\n", encoding="utf-8")
    docs_dir = project_repo / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)
    (docs_dir / "guide.md").write_text("# Guide\n", encoding="utf-8")
    ignored_dir = project_repo / "ignored"
    ignored_dir.mkdir(parents=True, exist_ok=True)
    (ignored_dir / "secret.md").write_text("# Secret\n", encoding="utf-8")
    (project_repo / ".gitignore").write_text("ignored/\n", encoding="utf-8")
    init_git_repo(project_repo)
    project_id = create_project(client, project_repo)

    response = client.get(f"/api/projects/{project_id}/docs")

    assert response.status_code == 200
    docs = response.get_json()["docs"]
    assert docs == [
        {"name": "guide.md", "path": "docs/guide.md"},
        {"name": "README.md", "path": "README.md"},
    ]


def test_reads_markdown_doc_content(client, project_repo: Path):
    (project_repo / "README.md").write_text("# Project\n", encoding="utf-8")
    init_git_repo(project_repo)
    project_id = create_project(client, project_repo)

    response = client.get(f"/api/projects/{project_id}/docs/README.md")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["name"] == "README.md"
    assert payload["path"] == "README.md"
    assert payload["content"] == "# Project\n"


def test_rejects_traversal_doc_path(client, project_repo: Path):
    (project_repo / "README.md").write_text("# Project\n", encoding="utf-8")
    init_git_repo(project_repo)
    project_id = create_project(client, project_repo)

    response = client.get(f"/api/projects/{project_id}/docs/%2E%2E/secret.md")

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid doc path"


def test_lists_markdown_docs_without_git_repository(client, project_repo: Path):
    (project_repo / "README.md").write_text("# README\n", encoding="utf-8")
    docs_dir = project_repo / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)
    (docs_dir / "guide.md").write_text("# Guide\n", encoding="utf-8")
    project_id = create_project(client, project_repo, "impl-no-git")

    response = client.get(f"/api/projects/{project_id}/docs")

    assert response.status_code == 200
    docs = response.get_json()["docs"]
    assert docs == [
        {"name": "guide.md", "path": "docs/guide.md"},
        {"name": "README.md", "path": "README.md"},
    ]
