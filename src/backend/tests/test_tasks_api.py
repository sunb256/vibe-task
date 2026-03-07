from pathlib import Path


def create_project(client, project_repo: Path) -> str:
    response = client.post(
        "/api/projects",
        json={
            "name": "impl",
            "repositoryPath": str(project_repo),
            "actionListPath": "tasks/action.yml",
            "doneListPath": "tasks/done.yml",
        },
    )
    return response.get_json()["id"]


def test_lists_tasks_from_action_and_done(client, project_repo: Path):
    project_id = create_project(client, project_repo)

    response = client.get(f"/api/projects/{project_id}/tasks")

    assert response.status_code == 200
    payload = response.get_json()
    assert {task["source"] for task in payload["tasks"]} == {"action", "done"}
    assert [task["id"] for task in payload["tasks"]] == ["1", "2"]


def test_updates_action_text(client, project_repo: Path):
    project_id = create_project(client, project_repo)

    response = client.patch(
        f"/api/projects/{project_id}/tasks/action/1",
        json={"action": "updated action"},
    )

    assert response.status_code == 200
    assert response.get_json()["action"] == "updated action\n"
    action_text = (project_repo / "tasks" / "action.yml").read_text(encoding="utf-8")
    assert "updated action" in action_text


def test_creates_action_task(client, project_repo: Path):
    project_id = create_project(client, project_repo)

    response = client.post(f"/api/projects/{project_id}/tasks/action")

    assert response.status_code == 201
    created = response.get_json()
    assert created["source"] == "action"
    assert created["id"] == "2"
    assert created["title"] == "-"
    assert created["url"] == "-"
    assert created["action"] == "TODO\n"
    action_text = (project_repo / "tasks" / "action.yml").read_text(encoding="utf-8")
    assert "id:" in action_text
    assert "TODO" in action_text


def test_creates_action_task_after_done_max_when_action_is_empty(client, project_repo: Path):
    action_file = project_repo / "tasks" / "action.yml"
    done_file = project_repo / "tasks" / "done.yml"
    action_file.write_text("impl_rule: |\n  sample\n\ntask: []\n", encoding="utf-8")
    done_file.write_text(
        "task:\n  - id: 12\n    url: done-url\n    title: done-title\n    action: |\n      done task\n",
        encoding="utf-8",
    )
    project_id = create_project(client, project_repo)

    response = client.post(f"/api/projects/{project_id}/tasks/action")

    assert response.status_code == 201
    created = response.get_json()
    assert created["source"] == "action"
    assert created["id"] == "13"


def test_deletes_task(client, project_repo: Path):
    project_id = create_project(client, project_repo)

    response = client.delete(f"/api/projects/{project_id}/tasks/done/2")

    assert response.status_code == 204
    tasks_response = client.get(f"/api/projects/{project_id}/tasks")
    payload = tasks_response.get_json()
    assert [task["id"] for task in payload["tasks"]] == ["1"]


def test_keeps_literal_block_text_unchanged(client, project_repo: Path):
    action_file = project_repo / "tasks" / "action.yml"
    action_file.write_text(
        "impl_rule: |\n  sample\n\ntask:\n  - id: 1\n    url: -\n    title: -\n    action: |\n      url: -\n      keep this text\n",
        encoding="utf-8",
    )
    project_id = create_project(client, project_repo)

    response = client.get(f"/api/projects/{project_id}/tasks/action/1")

    assert response.status_code == 200
    assert response.get_json()["action"] == "url: -\nkeep this text"


def test_expands_env_var_in_repository_path_when_loading_tasks(
    client,
    project_repo: Path,
    monkeypatch,
):
    monkeypatch.setenv("PROJECT_REPO_ROOT", str(project_repo))
    created = client.post(
        "/api/projects",
        json={
            "name": "impl-env",
            "repositoryPath": "$PROJECT_REPO_ROOT",
            "actionListPath": "tasks/action.yml",
            "doneListPath": "tasks/done.yml",
        },
    )
    project_id = created.get_json()["id"]

    listed = client.get(f"/api/projects/{project_id}/tasks")

    assert created.status_code == 201
    assert listed.status_code == 200
    payload = listed.get_json()
    assert [task["id"] for task in payload["tasks"]] == ["1", "2"]
