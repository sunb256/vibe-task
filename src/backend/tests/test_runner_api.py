from pathlib import Path

import pytest

from app.repositories.project_repository import ProjectRepository
from app.services.runner_service import RunnerService
from app.services.runner_service import reset_runner_process_store_for_test


class FakeProcess:
    def __init__(self, return_code: int | None) -> None:
        self.return_code = return_code
        self.terminated = False
        self.killed = False

    def poll(self) -> int | None:
        return self.return_code

    def terminate(self) -> None:
        self.terminated = True
        self.return_code = 0

    def wait(self, timeout: int | None = None) -> int:
        _ = timeout
        return 0

    def kill(self) -> None:
        self.killed = True
        self.return_code = 0


@pytest.fixture(autouse=True)
def clear_runner_processes() -> None:
    reset_runner_process_store_for_test()
    yield
    reset_runner_process_store_for_test()


def create_project(
    client,
    project_repo: Path,
    project_name: str = "impl",
    repository_path: str | None = None,
) -> str:
    response = client.post(
        "/api/projects",
        json={
            "name": project_name,
            "repositoryPath": repository_path or str(project_repo),
        },
    )
    assert response.status_code == 201
    return response.get_json()["id"]


def test_execute_runner_starts_process(client, project_repo: Path, monkeypatch):
    captured: dict[str, object] = {}

    def fake_popen(command, **kwargs):
        captured["command"] = command
        captured["cwd"] = kwargs.get("cwd")
        captured["env"] = kwargs.get("env")
        return FakeProcess(None)

    monkeypatch.setattr("app.services.runner_service.subprocess.Popen", fake_popen)
    project_id = create_project(client, project_repo)

    response = client.post(f"/api/projects/{project_id}/runner/execute")

    assert response.status_code == 202
    assert response.get_json() == {"running": True}
    command = captured["command"]
    executable = Path(command[0]).name
    assert executable in {"npm", "npx"}
    if executable == "npm":
        assert command[1:] == ["--prefix", "src/runner", "run", "start", "--", "--task", "impl"]
    else:
        assert command[1:] == [
            "--yes",
            "--prefix",
            "src/runner",
            "tsx",
            "src/runner/src/run.ts",
            "--task",
            "impl",
        ]
    assert captured["cwd"] == str(project_repo.parent)
    env = captured["env"]
    assert isinstance(env, dict)
    assert env["RUNNER_REPOSITORY_DIR"] == str(project_repo)


def test_execute_runner_falls_back_to_npx_when_npm_start_fails(client, project_repo: Path, monkeypatch):
    attempts: list[list[str]] = []

    def fake_resolve(self, command_name: str):
        if command_name == "npm":
            return "/opt/node/bin/npm"
        if command_name == "npx":
            return "/opt/node/bin/npx"
        return None

    def fake_popen(command, **kwargs):
        _ = kwargs
        attempts.append(command)
        if Path(command[0]).name == "npm":
            raise OSError("permission denied")
        return FakeProcess(None)

    monkeypatch.setattr(RunnerService, "_resolve_node_command", fake_resolve)
    monkeypatch.setattr("app.services.runner_service.subprocess.Popen", fake_popen)
    project_id = create_project(client, project_repo)

    response = client.post(f"/api/projects/{project_id}/runner/execute")

    assert response.status_code == 202
    assert response.get_json() == {"running": True}
    assert [Path(command[0]).name for command in attempts] == ["npm", "npx"]


def test_execute_runner_expands_home_in_repository_path(client, project_repo: Path, monkeypatch):
    captured: dict[str, object] = {}

    def fake_popen(command, **kwargs):
        captured["command"] = command
        captured["env"] = kwargs.get("env")
        return FakeProcess(None)

    monkeypatch.setenv("HOME", str(project_repo.parent))
    monkeypatch.setattr("app.services.runner_service.subprocess.Popen", fake_popen)
    project_id = create_project(
        client,
        project_repo,
        project_name="impl",
        repository_path="$HOME/sample-repo",
    )

    response = client.post(f"/api/projects/{project_id}/runner/execute")

    assert response.status_code == 202
    env = captured["env"]
    assert isinstance(env, dict)
    assert env["RUNNER_REPOSITORY_DIR"] == str(project_repo.parent / "sample-repo")


def test_execute_runner_returns_conflict_while_running(client, project_repo: Path, monkeypatch):
    monkeypatch.setattr(
        "app.services.runner_service.subprocess.Popen",
        lambda *_args, **_kwargs: FakeProcess(None),
    )
    project_id = create_project(client, project_repo)

    first = client.post(f"/api/projects/{project_id}/runner/execute")
    second = client.post(f"/api/projects/{project_id}/runner/execute")

    assert first.status_code == 202
    assert second.status_code == 409
    assert second.get_json()["error"] == "runner is already running"


def test_cancel_runner_stops_running_process(client, project_repo: Path, monkeypatch):
    process = FakeProcess(None)
    monkeypatch.setattr(
        "app.services.runner_service.subprocess.Popen",
        lambda *_args, **_kwargs: process,
    )
    project_id = create_project(client, project_repo)
    client.post(f"/api/projects/{project_id}/runner/execute")

    response = client.post(f"/api/projects/{project_id}/runner/cancel")

    assert response.status_code == 202
    assert response.get_json() == {"running": False}
    assert process.terminated is True


def test_cancel_runner_returns_conflict_when_not_running(client, project_repo: Path):
    project_id = create_project(client, project_repo)

    response = client.post(f"/api/projects/{project_id}/runner/cancel")

    assert response.status_code == 409
    assert response.get_json()["error"] == "runner is not running"


def test_get_runner_logs_returns_tail_lines(client, project_repo: Path):
    project_id = create_project(client, project_repo)
    log_dir = project_repo.parent / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    (log_dir / "log.log").write_text("line-1\nline-2\nline-3\n", encoding="utf-8")

    response = client.get(f"/api/projects/{project_id}/runner/logs?lines=2")

    assert response.status_code == 200
    assert response.get_json() == {"running": False, "log": "line-2\nline-3"}


def test_get_runner_logs_reports_running_process(client, project_repo: Path, monkeypatch):
    monkeypatch.setattr(
        "app.services.runner_service.subprocess.Popen",
        lambda *_args, **_kwargs: FakeProcess(None),
    )
    project_id = create_project(client, project_repo)
    client.post(f"/api/projects/{project_id}/runner/execute")

    response = client.get(f"/api/projects/{project_id}/runner/logs")

    assert response.status_code == 200
    assert response.get_json()["running"] is True


def test_build_runner_command_falls_back_to_npm_when_npx_is_unavailable(
    client,
    project_repo: Path,
    monkeypatch,
):
    project_id = create_project(client, project_repo)
    service = RunnerService(ProjectRepository(Path(client.application.config["PROJECTS_FILE"])))
    project = service.project_repository.get_project(project_id)

    def fake_resolve(command_name: str):
        if command_name == "npx":
            return None
        if command_name == "npm":
            return "/opt/node/bin/npm"
        return None

    monkeypatch.setattr(service, "_resolve_node_command", fake_resolve)

    command, env = service._build_runner_command(project)

    assert command == [
        "/opt/node/bin/npm",
        "--prefix",
        "src/runner",
        "run",
        "start",
        "--",
        "--task",
        "impl",
    ]
    assert env["PATH"].startswith("/opt/node/bin")


def test_build_runner_command_uses_npx_when_npm_is_unavailable(
    client,
    project_repo: Path,
    monkeypatch,
):
    project_id = create_project(client, project_repo)
    service = RunnerService(ProjectRepository(Path(client.application.config["PROJECTS_FILE"])))
    project = service.project_repository.get_project(project_id)

    def fake_resolve(command_name: str):
        if command_name == "npm":
            return None
        if command_name == "npx":
            return "/opt/node/bin/npx"
        return None

    monkeypatch.setattr(service, "_resolve_node_command", fake_resolve)

    command, env = service._build_runner_command(project)

    assert command == [
        "/opt/node/bin/npx",
        "--yes",
        "--prefix",
        "src/runner",
        "tsx",
        "src/runner/src/run.ts",
        "--task",
        "impl",
    ]
    assert env["PATH"].startswith("/opt/node/bin")
