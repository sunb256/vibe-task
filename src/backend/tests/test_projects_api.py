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


def test_updates_project_with_env_var_path(
    client,
    project_repo: Path,
    tmp_path: Path,
    monkeypatch,
):
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
    next_repo = tmp_path / "env-repo"
    tasks_dir = next_repo / "tasks"
    tasks_dir.mkdir(parents=True)
    (tasks_dir / "action.yml").write_text("impl_rule: |\n  sample\n\ntask: []\n", encoding="utf-8")
    (tasks_dir / "done.yml").write_text("task: []\n", encoding="utf-8")
    monkeypatch.setenv("PROJECT_REPO_ROOT", str(next_repo))

    response = client.patch(
        f"/api/projects/{project_id}",
        json={
            "name": "impl-env-updated",
            "repositoryPath": "$PROJECT_REPO_ROOT",
            "actionListPath": "tasks/action.yml",
            "doneListPath": "tasks/done.yml",
        },
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
        json={
            "name": "impl-1",
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
        json={
            "name": "impl-1",
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
        json={
            "name": "impl-env",
            "repositoryPath": "$PROJECT_REPO_ROOT",
            "actionListPath": "tasks/action.yml",
            "doneListPath": "tasks/done.yml",
        },
    )

    assert response.status_code == 201
    created = response.get_json()
    assert created["repositoryPath"] == "$PROJECT_REPO_ROOT"


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
