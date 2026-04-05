"""Prompts API contract tests kept for runner/CLI support."""

from pathlib import Path


def test_lists_prompt_files(client):
    response = client.get("/api/prompts")

    assert response.status_code == 200
    payload = response.get_json()
    names = [prompt["name"] for prompt in payload["prompts"]]
    assert names == ["alpha.md", "beta.md"]
    assert "content" not in payload["prompts"][0]


def test_reads_prompt_file(client):
    response = client.get("/api/prompts/alpha.md")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["name"] == "alpha.md"
    assert payload["content"] == "# Alpha\n"


def test_updates_prompt_file(client, prompts_dir: Path):
    response = client.patch("/api/prompts/alpha.md", json={"content": "# Updated\n"})

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["name"] == "alpha.md"
    assert payload["content"] == "# Updated\n"
    content = (prompts_dir / "alpha.md").read_text(encoding="utf-8")
    assert content == "# Updated\n"


def test_deletes_prompt_file(client):
    deleted = client.delete("/api/prompts/beta.md")

    assert deleted.status_code == 204
    listed = client.get("/api/prompts")
    payload = listed.get_json()
    names = [prompt["name"] for prompt in payload["prompts"]]
    assert names == ["alpha.md"]


def test_rejects_invalid_prompt_name(client):
    response = client.get("/api/prompts/nested/secret.md")

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid prompt name"
