from pathlib import Path


SAMPLE_ACTION = (
    "impl_rule: |\n"
    "  sample\n\n"
    "task:\n"
    "  - id: 1\n"
    "    url: -\n"
    "    title: -\n"
    "    action: |\n"
    "      first task\n"
)

SAMPLE_DONE = (
    "task:\n"
    "  - id: 2\n"
    "    url: done-url\n"
    "    title: done-title\n"
    "    action: |\n"
    "      done task\n"
)

SAMPLE_PENDING = (
    "task:\n"
    "  - id: 3\n"
    "    url: pending-url\n"
    "    title: pending-title\n"
    "    action: |\n"
    "      pending task\n"
)

SAMPLE_CANCEL = (
    "task:\n"
    "  - id: 4\n"
    "    url: cancel-url\n"
    "    title: cancel-title\n"
    "    action: |\n"
    "      cancel task\n"
)

SAMPLE_RUNNER = (
    "task:\n"
    "  - id: 5\n"
    "    url: runner-url\n"
    "    title: runner-title\n"
    "    action: |\n"
    "      runner task\n"
    "history:\n"
    "  - id: [1, 2, 3]\n"
    "    datetime: \"2026-03-22 09:00:00\"\n"
    "    status: done\n"
)


def seed_project_tasks(project_tasks_root: Path, project_name: str = "impl") -> None:
    project_dir = project_tasks_root / project_name
    project_dir.mkdir(parents=True, exist_ok=True)
    (project_dir / "action.yml").write_text(SAMPLE_ACTION, encoding="utf-8")
    (project_dir / "runner.yml").write_text(SAMPLE_RUNNER, encoding="utf-8")
    (project_dir / "pending.yml").write_text(SAMPLE_PENDING, encoding="utf-8")
    (project_dir / "done.yml").write_text(SAMPLE_DONE, encoding="utf-8")
    (project_dir / "cancel.yml").write_text(SAMPLE_CANCEL, encoding="utf-8")


def create_project(
    client,
    project_repo: Path,
    project_tasks_root: Path,
    *,
    project_name: str = "impl",
    with_seed: bool = True,
) -> str:
    response = client.post(
        "/api/projects",
        json={
            "name": project_name,
            "repositoryPath": str(project_repo),
        },
    )
    project_id = response.get_json()["id"]
    if with_seed:
        seed_project_tasks(project_tasks_root, project_name)
    return project_id


def test_lists_tasks_from_all_sources(client, project_repo: Path, project_tasks_root: Path):
    project_id = create_project(client, project_repo, project_tasks_root)

    response = client.get(f"/api/projects/{project_id}/tasks")

    assert response.status_code == 200
    payload = response.get_json()
    assert {task["source"] for task in payload["tasks"]} == {"action", "runner", "pending", "done", "cancel"}
    assert [task["id"] for task in payload["tasks"]] == ["1", "3", "2", "4", "5"]
    assert payload["runnerHistory"] == [
        {
            "id": ["1", "2", "3"],
            "datetime": "2026-03-22 09:00:00",
            "status": "done",
        }
    ]


def test_accepts_unquoted_runner_history_datetime(client, project_repo: Path, project_tasks_root: Path):
    project_id = create_project(client, project_repo, project_tasks_root, with_seed=False)
    runner_file = project_tasks_root / "impl" / "runner.yml"
    runner_file.write_text(
        (
            "task: []\n"
            "history:\n"
            "  - id: [1, 2, 3]\n"
            "    datetime: 2026-03-22 09:00:00\n"
            "    status: done\n"
        ),
        encoding="utf-8",
    )

    response = client.get(f"/api/projects/{project_id}/tasks")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["runnerHistory"] == [
        {
            "id": ["1", "2", "3"],
            "datetime": "2026-03-22 09:00:00",
            "status": "done",
        }
    ]


def test_creates_missing_status_files_when_listing_tasks(
    client,
    project_repo: Path,
    project_tasks_root: Path,
):
    project_id = create_project(client, project_repo, project_tasks_root)
    pending_file = project_tasks_root / "impl" / "pending.yml"
    cancel_file = project_tasks_root / "impl" / "cancel.yml"
    runner_file = project_tasks_root / "impl" / "runner.yml"
    pending_file.unlink()
    cancel_file.unlink()
    runner_file.unlink()

    response = client.get(f"/api/projects/{project_id}/tasks")

    assert response.status_code == 200
    assert pending_file.exists()
    assert cancel_file.exists()
    assert runner_file.exists()
    assert pending_file.read_text(encoding="utf-8") == "task: []\n"
    assert cancel_file.read_text(encoding="utf-8") == "task: []\n"
    assert runner_file.read_text(encoding="utf-8") == "task: []\nhistory: []\n"


def test_updates_action_text(client, project_repo: Path, project_tasks_root: Path):
    project_id = create_project(client, project_repo, project_tasks_root)

    response = client.patch(
        f"/api/projects/{project_id}/tasks/action/1",
        json={"action": "updated action"},
    )

    assert response.status_code == 200
    assert response.get_json()["action"] == "updated action\n"
    action_text = (project_tasks_root / "impl" / "action.yml").read_text(encoding="utf-8")
    assert "updated action" in action_text


def test_normalizes_crlf_action_text_on_update(client, project_repo: Path, project_tasks_root: Path):
    project_id = create_project(client, project_repo, project_tasks_root)

    response = client.patch(
        f"/api/projects/{project_id}/tasks/action/1",
        json={"action": "line 1\r\nline 2\r\n"},
    )

    assert response.status_code == 200
    assert response.get_json()["action"] == "line 1\nline 2\n"
    action_text = (project_tasks_root / "impl" / "action.yml").read_text(encoding="utf-8")
    assert "line 1" in action_text
    assert "line 2" in action_text
    assert "\r" not in action_text


def test_creates_action_task(client, project_repo: Path, project_tasks_root: Path):
    project_id = create_project(client, project_repo, project_tasks_root)

    response = client.post(f"/api/projects/{project_id}/tasks/action")

    assert response.status_code == 201
    created = response.get_json()
    assert created["source"] == "action"
    assert created["id"] == "2"
    assert created["title"] == "-"
    assert created["url"] == "-"
    assert created["action"] == "TODO\n"
    action_text = (project_tasks_root / "impl" / "action.yml").read_text(encoding="utf-8")
    assert "id:" in action_text
    assert "TODO" in action_text


def test_creates_action_task_after_done_max_when_action_is_empty(
    client,
    project_repo: Path,
    project_tasks_root: Path,
):
    project_id = create_project(client, project_repo, project_tasks_root, with_seed=False)
    action_file = project_tasks_root / "impl" / "action.yml"
    pending_file = project_tasks_root / "impl" / "pending.yml"
    done_file = project_tasks_root / "impl" / "done.yml"
    cancel_file = project_tasks_root / "impl" / "cancel.yml"
    runner_file = project_tasks_root / "impl" / "runner.yml"
    action_file.write_text("impl_rule: |\n  sample\n\ntask: []\n", encoding="utf-8")
    pending_file.write_text(
        "task:\n  - id: 16\n    url: pending-url\n    title: pending-title\n    action: |\n      pending task\n",
        encoding="utf-8",
    )
    done_file.write_text(
        "task:\n  - id: 12\n    url: done-url\n    title: done-title\n    action: |\n      done task\n",
        encoding="utf-8",
    )
    cancel_file.write_text("task: []\n", encoding="utf-8")
    runner_file.write_text("task: []\nhistory: []\n", encoding="utf-8")

    response = client.post(f"/api/projects/{project_id}/tasks/action")

    assert response.status_code == 201
    created = response.get_json()
    assert created["source"] == "action"
    assert created["id"] == "17"


def test_deletes_task(client, project_repo: Path, project_tasks_root: Path):
    project_id = create_project(client, project_repo, project_tasks_root)

    response = client.delete(f"/api/projects/{project_id}/tasks/done/2")

    assert response.status_code == 204
    tasks_response = client.get(f"/api/projects/{project_id}/tasks")
    payload = tasks_response.get_json()
    assert [task["id"] for task in payload["tasks"]] == ["1", "3", "4", "5"]


def test_moves_task_to_pending_source(client, project_repo: Path, project_tasks_root: Path):
    project_id = create_project(client, project_repo, project_tasks_root)

    response = client.patch(
        f"/api/projects/{project_id}/tasks/action/1",
        json={"action": "updated action", "nextSource": "pending"},
    )

    assert response.status_code == 200
    moved = response.get_json()
    assert moved["source"] == "pending"
    assert moved["action"] == "updated action\n"
    action_text = (project_tasks_root / "impl" / "action.yml").read_text(encoding="utf-8")
    pending_text = (project_tasks_root / "impl" / "pending.yml").read_text(encoding="utf-8")
    assert "updated action" not in action_text
    assert "updated action" in pending_text


def test_keeps_literal_block_text_unchanged(client, project_repo: Path, project_tasks_root: Path):
    project_id = create_project(client, project_repo, project_tasks_root, with_seed=False)
    action_file = project_tasks_root / "impl" / "action.yml"
    action_file.write_text(
        "impl_rule: |\n  sample\n\ntask:\n  - id: 1\n    url: -\n    title: -\n    action: |\n      url: -\n      keep this text\n",
        encoding="utf-8",
    )

    response = client.get(f"/api/projects/{project_id}/tasks/action/1")

    assert response.status_code == 200
    assert response.get_json()["action"] == "url: -\nkeep this text"


def test_expands_env_var_in_repository_path_when_loading_tasks(
    client,
    project_repo: Path,
    project_tasks_root: Path,
    monkeypatch,
):
    monkeypatch.setenv("PROJECT_REPO_ROOT", str(project_repo))
    created = client.post(
        "/api/projects",
        json={
            "name": "impl-env",
            "repositoryPath": "$PROJECT_REPO_ROOT",
        },
    )
    seed_project_tasks(project_tasks_root, "impl-env")
    project_id = created.get_json()["id"]

    listed = client.get(f"/api/projects/{project_id}/tasks")

    assert created.status_code == 201
    assert listed.status_code == 200
    payload = listed.get_json()
    assert [task["id"] for task in payload["tasks"]] == ["1", "3", "2", "4", "5"]


def test_creates_runner_task(client, project_repo: Path, project_tasks_root: Path):
    project_id = create_project(client, project_repo, project_tasks_root)

    response = client.post(f"/api/projects/{project_id}/tasks/runner")

    assert response.status_code == 201
    created = response.get_json()
    assert created["source"] == "runner"
    assert created["id"] == "6"
    assert created["title"] == "-"
    assert created["url"] == "-"
    assert created["action"] == "TODO\n"
    runner_text = (project_tasks_root / "impl" / "runner.yml").read_text(encoding="utf-8")
    assert "history:" in runner_text


def test_swaps_task_ids(client, project_repo: Path, project_tasks_root: Path):
    project_id = create_project(client, project_repo, project_tasks_root, with_seed=False)
    action_file = project_tasks_root / "impl" / "action.yml"
    action_file.write_text(
        (
            "impl_rule: |\n  sample\n\n"
            "task:\n"
            "  - id: 1\n"
            "    url: -\n"
            "    title: -\n"
            "    action: |\n"
            "      first task\n"
            "  - id: 2\n"
            "    url: -\n"
            "    title: -\n"
            "    action: |\n"
            "      second task\n"
        ),
        encoding="utf-8",
    )

    swapped = client.patch(
        f"/api/projects/{project_id}/tasks/action/1/swap",
        json={"swapWithId": "2"},
    )

    assert swapped.status_code == 204
    listed = client.get(f"/api/projects/{project_id}/tasks")
    assert listed.status_code == 200
    tasks = listed.get_json()["tasks"]
    action_ids = [task["id"] for task in tasks if task["source"] == "action"]
    assert action_ids == ["2", "1"]
