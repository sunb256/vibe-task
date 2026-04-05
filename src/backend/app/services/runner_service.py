import os
import shutil
import signal
import subprocess
from pathlib import Path
from threading import Lock

from app.errors import AppError
from app.models import ProjectRecord, RunnerLogRecord
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository, normalize_project_directory_name

RUNNER_START_CMD = ["--prefix", "src/runner", "run", "start", "--", "--task"]
RUNNER_FALLBACK_START_CMD = ["--yes", "--prefix", "src/runner", "tsx", "src/runner/src/run.ts", "--task"]
RUNNER_LOG_FILE = Path("logs") / "log.log"


class RunnerProcessStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._processes: dict[str, subprocess.Popen] = {}

    def start(
        self,
        project_id: str,
        command: list[str],
        cwd: Path,
        env: dict[str, str] | None = None,
    ) -> None:
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
                    start_new_session=True,
                    env=env,
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
            self._stop_process(process)
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

    def _stop_process(self, process: subprocess.Popen) -> None:
        pid = getattr(process, "pid", None)
        if isinstance(pid, int) and pid > 0:
            self._stop_process_group(process, pid)
            return
        self._stop_single_process(process)

    def _stop_process_group(self, process: subprocess.Popen, pid: int) -> None:
        try:
            os.killpg(pid, signal.SIGTERM)
        except ProcessLookupError:
            return
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(pid, signal.SIGKILL)
            except ProcessLookupError:
                return
            process.wait(timeout=3)

    def _stop_single_process(self, process: subprocess.Popen) -> None:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=3)


runner_process_store = RunnerProcessStore()


class RunnerService:
    def __init__(self, project_repository: ProjectRepository) -> None:
        self.project_repository = project_repository
        tasks_root = self.project_repository.projects_file.parent / "projects"
        self.task_repository = TaskRepository(tasks_root)
        self.repo_root = self._resolve_repo_root(self.project_repository.projects_file)

    def execute_runner(self, project_id: str) -> None:
        project = self._load_project(project_id)
        command, env = self._build_runner_command(project)
        runner_process_store.start(project.id, command, self.repo_root, env)

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

    def _build_runner_command(
        self,
        project: ProjectRecord,
    ) -> tuple[list[str], dict[str, str]]:
        task_project = normalize_project_directory_name(project.name, project.id)
        npm_path = self._resolve_node_command("npm")
        if npm_path:
            return [npm_path, *RUNNER_START_CMD, task_project], self._build_runner_env(npm_path)

        npx_path = self._resolve_node_command("npx")
        if npx_path:
            return [npx_path, *RUNNER_FALLBACK_START_CMD, task_project], self._build_runner_env(
                npx_path,
            )

        raise AppError("failed to start runner", 500)

    def _build_runner_env(self, command_path: str) -> dict[str, str]:
        env = os.environ.copy()
        # npm/npx が symlink の場合、resolve() すると lib/node_modules 配下へ飛び
        # node 実行バイナリと同居しないため、元の bin ディレクトリを優先する。
        bin_dir = str(Path(command_path).parent)
        current_path = env.get("PATH", "")
        if current_path:
            env["PATH"] = f"{bin_dir}{os.pathsep}{current_path}"
        else:
            env["PATH"] = bin_dir
        return env

    def _resolve_node_command(self, command_name: str) -> str | None:
        direct = shutil.which(command_name)
        if direct:
            return direct

        home = Path.home()
        nvm_versions_dir = home / ".nvm" / "versions" / "node"
        if nvm_versions_dir.exists():
            candidates = sorted(nvm_versions_dir.glob(f"*/bin/{command_name}"))
            if candidates:
                return str(candidates[-1])

        volta_command = home / ".volta" / "bin" / command_name
        if volta_command.exists():
            return str(volta_command)

        asdf_command = home / ".asdf" / "shims" / command_name
        if asdf_command.exists():
            return str(asdf_command)

        return None

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
