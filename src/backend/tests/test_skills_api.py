from pathlib import Path


def test_lists_skill_files(client):
    response = client.get("/api/skills")

    assert response.status_code == 200
    payload = response.get_json()
    names = [skill["name"] for skill in payload["skills"]]
    assert names == ["alpha", "beta"]
    assert "content" not in payload["skills"][0]
    assert payload["skills"][0]["source"] == "global"
    assert payload["skills"][0]["editable"] is True


def test_lists_project_skill_files(client, project_repo: Path):
    local_skill = project_repo / ".codex" / "skills" / "local"
    local_skill.mkdir(parents=True)
    (local_skill / "SKILL.md").write_text("# Local Skill\n", encoding="utf-8")
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

    response = client.get("/api/skills")

    assert response.status_code == 200
    payload = response.get_json()
    local = next(skill for skill in payload["skills"] if skill["path"].endswith("local/SKILL.md"))
    assert local["name"] == "local"
    assert local["source"] == "project"
    assert local["projectName"] == "impl"
    assert local["editable"] is True


def test_reads_skill_file(client):
    response = client.get("/api/skills/alpha")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["name"] == "alpha"
    assert payload["content"] == "# Alpha Skill\n"


def test_reads_project_skill_file_by_path(client, project_repo: Path):
    local_skill = project_repo / ".codex" / "skills" / "local"
    local_skill.mkdir(parents=True)
    skill_file = local_skill / "SKILL.md"
    skill_file.write_text("# Local Skill\n", encoding="utf-8")
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

    response = client.get("/api/skills/file", query_string={"path": str(skill_file)})

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["name"] == "local"
    assert payload["source"] == "project"
    assert payload["projectName"] == "impl"
    assert payload["content"] == "# Local Skill\n"


def test_creates_skill_file(client, skills_dir: Path):
    response = client.post(
        "/api/skills",
        json={"name": "gamma", "content": "# Gamma Skill\n"},
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["name"] == "gamma"
    content = (skills_dir / "gamma" / "SKILL.md").read_text(encoding="utf-8")
    assert content == "# Gamma Skill\n"


def test_updates_skill_file(client, skills_dir: Path):
    response = client.patch("/api/skills/alpha", json={"content": "# Updated Skill\n"})

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["name"] == "alpha"
    assert payload["content"] == "# Updated Skill\n"
    content = (skills_dir / "alpha" / "SKILL.md").read_text(encoding="utf-8")
    assert content == "# Updated Skill\n"


def test_updates_project_skill_file_by_path(client, project_repo: Path):
    local_skill = project_repo / ".codex" / "skills" / "local"
    local_skill.mkdir(parents=True)
    skill_file = local_skill / "SKILL.md"
    skill_file.write_text("# Local Skill\n", encoding="utf-8")
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

    response = client.patch(
        "/api/skills/file",
        json={"path": str(skill_file), "content": "# Updated Local Skill\n"},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["name"] == "local"
    assert payload["source"] == "project"
    assert payload["projectName"] == "impl"
    assert payload["content"] == "# Updated Local Skill\n"
    content = skill_file.read_text(encoding="utf-8")
    assert content == "# Updated Local Skill\n"


def test_deletes_project_skill_file_by_path(client, project_repo: Path):
    local_skill = project_repo / ".codex" / "skills" / "local"
    local_skill.mkdir(parents=True)
    skill_file = local_skill / "SKILL.md"
    skill_file.write_text("# Local Skill\n", encoding="utf-8")
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

    response = client.delete("/api/skills/file", json={"path": str(skill_file)})

    assert response.status_code == 204
    assert not skill_file.exists()


def test_rejects_invalid_skill_name(client):
    response = client.get("/api/skills/nested/secret")

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid skill name"
