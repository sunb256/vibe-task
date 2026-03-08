from pathlib import Path


def test_lists_skill_files(client):
    response = client.get("/api/skills")

    assert response.status_code == 200
    payload = response.get_json()
    names = [skill["name"] for skill in payload["skills"]]
    assert names == ["alpha", "beta"]
    assert "content" not in payload["skills"][0]


def test_reads_skill_file(client):
    response = client.get("/api/skills/alpha")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["name"] == "alpha"
    assert payload["content"] == "# Alpha Skill\n"


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


def test_rejects_invalid_skill_name(client):
    response = client.get("/api/skills/nested/secret")

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid skill name"
