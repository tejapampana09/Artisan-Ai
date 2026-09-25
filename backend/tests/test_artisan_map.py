import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_get_craft_clusters():
    res = client.get("/api/artisan/map/clusters")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 10
    names = [c["name"] for c in data]
    assert "Etikoppaka" in names
    assert "Pochampally" in names
    assert "Channapatna" in names
    assert "Bidar" in names
    assert "Jaipur" in names

def test_get_artisan_map_pins():
    res = client.get("/api/artisan/map/pins")
    assert res.status_code == 200
    pins = res.json()
    assert isinstance(pins, list)

def test_update_artisan_location(client, artisan_headers):
    # Update with Etikoppaka coordinates
    res = client.put(
        "/api/artisan/location",
        json={
            "latitude": 17.5255,
            "longitude": 82.7485,
            "craft_cluster": "Etikoppaka",
            "state": "Andhra Pradesh",
            "district": "Anakapalli",
            "pincode": "531055"
        },
        headers=artisan_headers
    )
    assert res.status_code == 200
    body = res.json()
    assert body["craft_cluster"] == "Etikoppaka"
    assert round(body["latitude"], 4) == 17.5255
    assert round(body["longitude"], 4) == 82.7485
    assert body["state"] == "Andhra Pradesh"

    # Now verify it shows up in map pins!
    pins_res = client.get("/api/artisan/map/pins?cluster=Etikoppaka")
    assert pins_res.status_code == 200
    pins = pins_res.json()
    assert len(pins) >= 1
    assert any(p["craft_cluster"] == "Etikoppaka" for p in pins)
