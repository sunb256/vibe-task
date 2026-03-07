from pathlib import Path


def test_create_and_list_projects(client, project_repo: Path):
    response = client.post(
        "/api/projects",
        json={
            "name": "impl",
            "repositoryPath": str(project_repo),
            "actionListPath": "tasks/action.yml",
            "doneListPath": "tasks/done.yml",
        },
    )

    assert response.status_code == 201
    created = response.get_json()
    assert created["id"] == "1"
    assert created["name"] == "impl"
    assert created["actionListPath"] == "tasks/action.yml"

    list_response = client.get("/api/projects")

    assert list_response.status_code == 200
    payload = list_response.get_json()
    assert payload["projects"][0]["name"] == "impl"


def test_assigns_sequential_ids(client, project_repo: Path):
    first = client.post(
        "/api/projects",
        json={
            "name": "impl",
            "repositoryPath": str(project_repo),
            "actionListPath": "tasks/action.yml",
            "doneListPath": "tasks/done.yml",
        },
    )
    second = client.post(
        "/api/projects",
        json={
            "name": "impl-2",
            "repositoryPath": str(project_repo),
            "actionListPath": "tasks/action.yml",
            "doneListPath": "tasks/done.yml",
        },
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.get_json()["id"] == "1"
    assert second.get_json()["id"] == "2"


def test_rejects_missing_repository(client, tmp_path: Path):
    response = client.post(
        "/api/projects",
        json={
            "name": "broken",
            "repositoryPath": str(tmp_path / "missing"),
            "actionListPath": "tasks/action.yml",
            "doneListPath": "tasks/done.yml",
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "repositoryPath must be an existing directory"


def test_updates_project(client, project_repo: Path, tmp_path: Path):
    created = client.post(
        "/api/projects",
        json={
            "name": "impl",
            "repositoryPath": str(project_repo),
            "actionListPath": "tasks/action.yml",
            "doneListPath": "tasks/done.yml",
        },
    )
    project_id = created.get_json()["id"]
    next_repo = tmp_path / "next-repo"
    tasks_dir = next_repo / "tasks"
    tasks_dir.mkdir(parents=True)
    (tasks_dir / "action.yml").write_text(
        "impl_rule: |\n  sample\n\ntask: []\n",
        encoding="utf-8",
    )
    (tasks_dir / "done.yml").write_text("task: []\n", encoding="utf-8")

    response = client.patch(
        f"/api/projects/{project_id}",
        json={
            "name": "impl-updated",
            "repositoryPath": str(next_repo),
            "actionListPath": "tasks/action.yml",
            "doneListPath": "tasks/done.yml",
        },
    )

    assert response.status_code == 200
    updated = response.get_json()
    assert updated["id"] == project_id
    assert updated["name"] == "impl-updated"
    assert updated["repositoryPath"] == str(next_repo.resolve())
    listed = client.get("/api/projects")
    payload = listed.get_json()
    assert payload["projects"][0]["name"] == "impl-updated"


def test_accepts_repository_path_with_env_var(client, project_repo: Path, monkeypatch):
    monkeypatch.setenv("PROJECT_REPO_ROOT", str(project_repo))
    response = client.post(
        "/api/projects",
        json={
            "name": "impl-env",
            "repositoryPath": "$PROJECT_REPO_ROOT",
            "actionListPath": "tasks/action.yml",
            "doneListPath": "tasks/done.yml",
        },
    )

    assert response.status_code == 201
    created = response.get_json()
    assert created["repositoryPath"] == str(project_repo.resolve())


def test_exports_projects_file(client, project_repo: Path):
    created = client.post(
        "/api/projects",
        json={
            "name": "impl",
            "repositoryPath": str(project_repo),
            "actionListPath": "tasks/action.yml",
            "doneListPath": "tasks/done.yml",
        },
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
        "    actionListPath: tasks/action.yml\n"
        "    doneListPath: tasks/done.yml\n"
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
