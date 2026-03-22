import subprocess
from pathlib import Path
from threading import Lock

from app.errors import AppError
from app.models import ProjectRecord, RunnerLogRecord
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository, normalize_project_directory_name

RUNNER_START_CMD = ["npx", "tsx", "src/runner/src/run.ts", "--task"]
RUNNER_LOG_FILE = Path("logs") / "log.log"


class RunnerProcessStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._processes: dict[str, subprocess.Popen] = {}

    def start(self, project_id: str, command: list[str], cwd: Path) -> None:
        with self._lock:
            if self._is_running_locked(project_id):
                raise AppError("runner is already running", 409)
            try:
                process = subprocess.Popen(
                    command,
                    cwd=str(cwd),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    text=True,
                )
            except OSError as error:
                raise AppError("failed to start runner", 500) from error
            self._processes[project_id] = process

    def is_running(self, project_id: str) -> bool:
        with self._lock:
            return self._is_running_locked(project_id)

    def stop(self, project_id: str) -> None:
        with self._lock:
            process = self._processes.get(project_id)
            if process is None or process.poll() is not None:
                self._processes.pop(project_id, None)
                raise AppError("runner is not running", 409)
            process.terminate()
            self._processes.pop(project_id, None)

    def clear(self) -> None:
        with self._lock:
            self._processes.clear()

    def _is_running_locked(self, project_id: str) -> bool:
        process = self._processes.get(project_id)
        if process is None:
            return False
        if process.poll() is None:
            return True
        self._processes.pop(project_id, None)
        return False


runner_process_store = RunnerProcessStore()


class RunnerService:
    def __init__(self, project_repository: ProjectRepository) -> None:
        self.project_repository = project_repository
        tasks_root = self.project_repository.projects_file.parent / "projects"
        self.task_repository = TaskRepository(tasks_root)
        self.repo_root = self._resolve_repo_root(self.project_repository.projects_file)

    def execute_runner(self, project_id: str) -> None:
        project = self._load_project(project_id)
        command = self._build_runner_command(project)
        runner_process_store.start(project.id, command, self.repo_root)

    def cancel_runner(self, project_id: str) -> None:
        project = self._load_project(project_id)
        runner_process_store.stop(project.id)

    def read_runner_logs(self, project_id: str, lines: int) -> RunnerLogRecord:
        self._load_project(project_id)
        running = runner_process_store.is_running(project_id)
        return RunnerLogRecord(running=running, log=self._tail_runner_log(lines))

    def _load_project(self, project_id: str) -> ProjectRecord:
        project = self.project_repository.get_project(project_id)
        self.task_repository.ensure_project_files(project)
        return project

    def _build_runner_command(self, project: ProjectRecord) -> list[str]:
        task_project = normalize_project_directory_name(project.name, project.id)
        return [*RUNNER_START_CMD, task_project]

    def _tail_runner_log(self, lines: int) -> str:
        log_path = self.repo_root / RUNNER_LOG_FILE
        if not log_path.exists():
            return ""
        content = log_path.read_text(encoding="utf-8", errors="ignore")
        if not content:
            return ""
        rows = content.splitlines()
        return "\n".join(rows[-lines:])

    def _resolve_repo_root(self, projects_file: Path) -> Path:
        projects_parent = projects_file.parent
        if projects_parent.name == "tasks":
            return projects_parent.parent
        return projects_parent


def reset_runner_process_store_for_test() -> None:
    runner_process_store.clear()
