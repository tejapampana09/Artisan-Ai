import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.models import Product

client = TestClient(app)

def test_offline_sync_other_cost_support_and_per_item_status():
    """
    Verifies that POST /api/sync/batch includes and persists other_cost for offline created products,
    and returns explicit client_temp_id and status per item.
    """
    uid = uuid.uuid4().hex[:6]
    artisan_res = client.post("/api/auth/register", json={
        "name": f"Offline Artisan {uid}",
        "email": f"offline.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = artisan_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client_temp_id = f"draft_local_{uid}"

    # Batch sync payload with other_cost
    sync_res = client.post("/api/sync/batch", json={
        "client_sync_timestamp": "2026-09-07T22:00:00Z",
        "products": [
            {
                "client_temp_id": client_temp_id,
                "title": "Offline Craft Saree",
                "category": "Kalamkari",
                "materials": "Cotton, Natural Dyes",
                "price": 1500.0,
                "stock": 5,
                "material_cost": 400.0,
                "labour_cost": 300.0,
                "packaging_cost": 100.0,
                "other_cost": 200.0,  # other_cost = 200.0
                "min_margin_pct": 0.20
            }
        ]
    }, headers=headers)

    assert sync_res.status_code == 200
    data = sync_res.json()

    assert data["status"] == "success"
    assert len(data["products_synced"]) == 1

    prod_result = data["products_synced"][0]
    assert prod_result["client_temp_id"] == client_temp_id
    assert prod_result["server_id"] > 0
    assert prod_result["status"] == "PUBLISHED"

    # Verify database persistence of other_cost
    server_id = prod_result["server_id"]
    db = SessionLocal()
    try:
        db_prod = db.query(Product).filter(Product.id == server_id).first()
        assert db_prod is not None
        assert float(db_prod.other_cost) == 200.0
        assert float(db_prod.material_cost) == 400.0
    finally:
        db.close()
