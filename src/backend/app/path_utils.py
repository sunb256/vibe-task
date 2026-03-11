import os
from pathlib import Path


def resolve_user_path(value: str) -> Path:
    expanded = _expand_home_prefix(os.path.expandvars(value))
    return Path(expanded).expanduser().resolve()


def _expand_home_prefix(value: str) -> str:
    home = str(_home_dir())
    for prefix in ("${HOME}", "$HOME"):
        if value == prefix:
            return home
        if value.startswith(f"{prefix}/") or value.startswith(f"{prefix}\\"):
            return home + value[len(prefix) :]
    return value


def _home_dir() -> Path:
    return Path.home()
