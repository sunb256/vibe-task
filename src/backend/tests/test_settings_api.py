def test_returns_default_settings(client):
    response = client.get("/api/settings")

    assert response.status_code == 200
    assert response.get_json() == {"headerBand": "zinc"}


def test_updates_settings_and_persists(client, projects_file):
    updated = client.patch("/api/settings", json={"headerBand": "navy"})

    assert updated.status_code == 200
    assert updated.get_json() == {"headerBand": "navy"}
    assert "settings:" in projects_file.read_text(encoding="utf-8")
    listed = client.get("/api/settings")
    assert listed.get_json() == {"headerBand": "navy"}


def test_rejects_invalid_header_band(client):
    response = client.patch("/api/settings", json={"headerBand": "pink"})

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid headerBand"
