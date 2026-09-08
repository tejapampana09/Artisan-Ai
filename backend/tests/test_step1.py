from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


def test_user_mode_toggle_single_account():
    # Initial fetch
    res = client.get("/api/me")
    assert res.status_code == 200
    initial_user = res.json()
    assert initial_user["active_mode"] in ["SELL", "BUY"]

    # Toggle to BUY
    toggle_buy = client.patch("/api/me/mode", json={"mode": "BUY"})
    assert toggle_buy.status_code == 200
    assert toggle_buy.json()["active_mode"] == "BUY"

    # Toggle back to SELL
    toggle_sell = client.patch("/api/me/mode", json={"mode": "SELL"})
    assert toggle_sell.status_code == 200
    assert toggle_sell.json()["active_mode"] == "SELL"
