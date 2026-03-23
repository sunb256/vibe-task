import subprocess
from pathlib import Path

from app.errors import AppError
from app.models import ProjectDocFile, ProjectDocSummary

EXCLUDED_DOC_DIRS = frozenset({".venv", "node_modules"})


class DocRepository:
    def list_docs(self, repository_root: Path) -> list[ProjectDocSummary]:
        root = self._require_repository_root(repository_root)
        doc_paths = self._list_doc_paths(root)
        docs = [self._to_doc_summary(path) for path in doc_paths]
        return sorted(docs, key=lambda item: item.path.lower())

    def get_doc(self, repository_root: Path, doc_path: str) -> ProjectDocFile:
        root = self._require_repository_root(repository_root)
        normalized = self._normalize_doc_path(doc_path)
        allowed = {item.path for item in self.list_docs(root)}
        if normalized not in allowed:
            raise AppError("doc not found", 404)
        file_path = (root / normalized).resolve()
        content = file_path.read_text(encoding="utf-8")
        return ProjectDocFile(
            name=file_path.name,
            path=normalized,
            content=content,
        )

    def _require_repository_root(self, repository_root: Path) -> Path:
        root = repository_root.expanduser().resolve()
        if not root.exists() or not root.is_dir():
            raise AppError("repositoryPath must be an existing directory", 400)
        return root

    def _list_doc_paths(self, root: Path) -> list[Path]:
        git_paths = self._list_doc_paths_with_git(root)
        if git_paths is not None:
            return git_paths
        return self._list_doc_paths_with_walk(root)

    def _list_doc_paths_with_git(self, root: Path) -> list[Path] | None:
        try:
            completed = subprocess.run(
                [
                    "git",
                    "-C",
                    str(root),
                    "ls-files",
                    "--cached",
                    "--others",
                    "--exclude-standard",
                    "--",
                    "*.md",
                ],
                check=False,
                capture_output=True,
                text=True,
            )
        except OSError:
            return None
        if completed.returncode != 0:
            return None
        doc_paths = []
        for line in completed.stdout.splitlines():
            relative = self._safe_relative_path(root, line.strip())
            if relative is None:
                continue
            if relative.suffix.lower() != ".md":
                continue
            if self._is_excluded_doc_path(relative):
                continue
            doc_paths.append(relative)
        return doc_paths

    def _list_doc_paths_with_walk(self, root: Path) -> list[Path]:
        doc_paths = []
        for path in root.rglob("*.md"):
            if not path.is_file():
                continue
            relative = path.resolve().relative_to(root)
            if self._is_hidden_git_path(relative):
                continue
            if self._is_excluded_doc_path(relative):
                continue
            doc_paths.append(relative)
        return doc_paths

    def _safe_relative_path(self, root: Path, raw_path: str) -> Path | None:
        if not raw_path:
            return None
        if raw_path.startswith("/"):
            return None
        normalized = raw_path.replace("\\", "/")
        candidate = (root / normalized).resolve()
        if root not in candidate.parents and candidate != root:
            return None
        if not candidate.exists() or not candidate.is_file():
            return None
        return candidate.relative_to(root)

    def _is_hidden_git_path(self, path: Path) -> bool:
        return any(part == ".git" for part in path.parts)

    def _is_excluded_doc_path(self, path: Path) -> bool:
        lowered_parts = {part.lower() for part in path.parts}
        return any(name in lowered_parts for name in EXCLUDED_DOC_DIRS)

    def _normalize_doc_path(self, doc_path: str) -> str:
        normalized = doc_path.strip().replace("\\", "/").lstrip("/")
        if not normalized:
            raise AppError("doc path is required", 400)
        parts = [part for part in normalized.split("/") if part]
        if any(part == ".." for part in parts):
            raise AppError("invalid doc path", 400)
        if not parts or not parts[-1].lower().endswith(".md"):
            raise AppError("invalid doc path", 400)
        return "/".join(parts)

    def _to_doc_summary(self, relative: Path) -> ProjectDocSummary:
        return ProjectDocSummary(name=relative.name, path=relative.as_posix())
