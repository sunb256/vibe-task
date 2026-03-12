def test_returns_default_settings(client):
    response = client.get("/api/settings")

    assert response.status_code == 200
    assert response.get_json() == {"headerBand": "zinc", "customHeaderColor": ""}


def test_updates_settings_and_persists(client, projects_file):
    updated = client.patch(
        "/api/settings",
        json={"headerBand": "navy", "customHeaderColor": "#1f2937"},
    )

    assert updated.status_code == 200
    assert updated.get_json() == {"headerBand": "navy", "customHeaderColor": "#1f2937"}
    assert "settings:" in projects_file.read_text(encoding="utf-8")
    listed = client.get("/api/settings")
    assert listed.get_json() == {"headerBand": "navy", "customHeaderColor": "#1f2937"}


def test_updates_custom_header_color(client):
    response = client.patch(
        "/api/settings",
        json={"headerBand": "custom", "customHeaderColor": "#123456"},
    )

    assert response.status_code == 200
    assert response.get_json() == {"headerBand": "custom", "customHeaderColor": "#123456"}


def test_rejects_invalid_header_band(client):
    response = client.patch("/api/settings", json={"headerBand": "pink"})

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid headerBand"


def test_rejects_invalid_custom_header_color(client):
    response = client.patch(
        "/api/settings",
        json={"headerBand": "custom", "customHeaderColor": "#12zz56"},
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid customHeaderColor"
