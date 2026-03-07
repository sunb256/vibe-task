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
