from pathlib import Path

import pytest

from app import path_utils


def project_payload(name: str, repository_path: str) -> dict[str, str]:
    return {
        "name": name,
        "repositoryPath": repository_path,
    }


def test_creates_projects_file_when_missing(client, projects_file: Path):
    assert not projects_file.exists()

    response = client.get("/api/projects")

    assert response.status_code == 200
    assert response.get_json()["projects"] == []
    assert projects_file.exists()
    assert "projects" in projects_file.read_text(encoding="utf-8")


def test_create_and_list_projects(client, project_repo: Path):
    response = client.post(
        "/api/projects",
        json=project_payload("impl", str(project_repo)),
    )

    assert response.status_code == 201
    created = response.get_json()
    assert created["id"] == "1"
    assert created["name"] == "impl"
    assert "actionListPath" not in created
    assert "doneListPath" not in created

    list_response = client.get("/api/projects")

    assert list_response.status_code == 200
    payload = list_response.get_json()
    assert payload["projects"][0]["name"] == "impl"


def test_creates_project_task_files_on_create(
    client,
    project_repo: Path,
    project_tasks_root: Path,
):
    response = client.post(
        "/api/projects",
        json=project_payload("impl", str(project_repo)),
    )

    assert response.status_code == 201
    action_file = project_tasks_root / "impl" / "action.yml"
    done_file = project_tasks_root / "impl" / "done.yml"
    assert action_file.exists()
    assert done_file.exists()
    assert action_file.read_text(encoding="utf-8") == "task: []\n"
    assert done_file.read_text(encoding="utf-8") == "task: []\n"


def test_assigns_sequential_ids(client, project_repo: Path):
    first = client.post(
        "/api/projects",
        json=project_payload("impl", str(project_repo)),
    )
    second = client.post(
        "/api/projects",
        json=project_payload("impl-2", str(project_repo)),
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.get_json()["id"] == "1"
    assert second.get_json()["id"] == "2"


def test_rejects_missing_repository(client, tmp_path: Path):
    response = client.post(
        "/api/projects",
        json=project_payload("broken", str(tmp_path / "missing")),
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "repositoryPath must be an existing directory"


def test_updates_project(
    client,
    project_repo: Path,
    project_tasks_root: Path,
    tmp_path: Path,
):
    created = client.post(
        "/api/projects",
        json=project_payload("impl", str(project_repo)),
    )
    project_id = created.get_json()["id"]
    next_repo = tmp_path / "next-repo"
    next_repo.mkdir(parents=True)

    response = client.patch(
        f"/api/projects/{project_id}",
        json=project_payload("impl-updated", str(next_repo)),
    )

    assert response.status_code == 200
    updated = response.get_json()
    assert updated["id"] == project_id
    assert updated["name"] == "impl-updated"
    assert updated["repositoryPath"] == str(next_repo.resolve())
    assert not (project_tasks_root / "impl").exists()
    assert (project_tasks_root / "impl-updated" / "action.yml").exists()
    listed = client.get("/api/projects")
    payload = listed.get_json()
    assert payload["projects"][0]["name"] == "impl-updated"


def test_updates_project_with_env_var_path(
    client,
    project_repo: Path,
    tmp_path: Path,
    monkeypatch,
):
    created = client.post(
        "/api/projects",
        json=project_payload("impl", str(project_repo)),
    )
    project_id = created.get_json()["id"]
    next_repo = tmp_path / "env-repo"
    next_repo.mkdir(parents=True)
    monkeypatch.setenv("PROJECT_REPO_ROOT", str(next_repo))

    response = client.patch(
        f"/api/projects/{project_id}",
        json=project_payload("impl-env-updated", "$PROJECT_REPO_ROOT"),
    )

    assert response.status_code == 200
    updated = response.get_json()
    assert updated["repositoryPath"] == "$PROJECT_REPO_ROOT"
    listed = client.get(f"/api/projects/{project_id}/tasks")
    assert listed.status_code == 200
    tasks = listed.get_json()["tasks"]
    assert tasks == []


def test_deletes_project(client, project_repo: Path):
    first = client.post(
        "/api/projects",
        json=project_payload("impl-1", str(project_repo)),
    )
    second = client.post(
        "/api/projects",
        json=project_payload("impl-2", str(project_repo)),
    )

    deleted = client.delete(f"/api/projects/{first.get_json()['id']}")

    assert deleted.status_code == 204
    listed = client.get("/api/projects")
    projects = listed.get_json()["projects"]
    assert [project["id"] for project in projects] == [second.get_json()["id"]]


def test_returns_not_found_when_deleting_missing_project(client):
    response = client.delete("/api/projects/404")

    assert response.status_code == 404
    assert response.get_json()["error"] == "project not found"


def test_reorders_projects(client, project_repo: Path):
    first = client.post(
        "/api/projects",
        json=project_payload("impl-1", str(project_repo)),
    )
    second = client.post(
        "/api/projects",
        json=project_payload("impl-2", str(project_repo)),
    )

    swapped = client.patch(
        "/api/projects/reorder",
        json={"sourceId": first.get_json()["id"], "targetId": second.get_json()["id"]},
    )

    assert swapped.status_code == 204
    listed = client.get("/api/projects")
    assert listed.status_code == 200
    projects = listed.get_json()["projects"]
    assert [project["id"] for project in projects] == ["2", "1"]


def test_accepts_repository_path_with_env_var(client, project_repo: Path, monkeypatch):
    monkeypatch.setenv("PROJECT_REPO_ROOT", str(project_repo))
    response = client.post(
        "/api/projects",
        json=project_payload("impl-env", "$PROJECT_REPO_ROOT"),
    )

    assert response.status_code == 201
    created = response.get_json()
    assert created["repositoryPath"] == "$PROJECT_REPO_ROOT"


@pytest.mark.parametrize("repository_path", ["$HOME/ghq/impl", "${HOME}/ghq/impl"])
def test_accepts_repository_path_with_home_alias_when_home_env_missing(
    client,
    tmp_path: Path,
    monkeypatch,
    repository_path: str,
):
    home_dir = tmp_path / "home"
    project_repo = home_dir / "ghq" / "impl"
    project_repo.mkdir(parents=True)
    monkeypatch.delenv("HOME", raising=False)
    monkeypatch.setattr(path_utils, "_home_dir", lambda: home_dir)

    response = client.post(
        "/api/projects",
        json=project_payload("impl-home", repository_path),
    )

    assert response.status_code == 201
    created = response.get_json()
    assert created["repositoryPath"] == repository_path


def test_exports_projects_file(client, project_repo: Path):
    created = client.post(
        "/api/projects",
        json=project_payload("impl", str(project_repo)),
    )

    assert created.status_code == 201
    response = client.get("/api/projects/export")

    assert response.status_code == 200
    payload = response.get_json()
    assert "projects:" in payload["content"]
    assert "name: impl" in payload["content"]


def test_imports_projects_file(client):
    content = (
        "projects:\n"
        "  - id: 10\n"
        "    name: imported\n"
        "    repositoryPath: /tmp/imported\n"
    )
    response = client.post("/api/projects/import", json={"content": content})

    assert response.status_code == 204
    listed = client.get("/api/projects")

    assert listed.status_code == 200
    payload = listed.get_json()
    assert payload["projects"][0]["id"] == "10"
    assert payload["projects"][0]["name"] == "imported"


def test_rejects_invalid_projects_import(client):
    response = client.post("/api/projects/import", json={"content": "projects: invalid"})

    assert response.status_code == 400
    assert response.get_json()["error"] == "projects file is invalid"
