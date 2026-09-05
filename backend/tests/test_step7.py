import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_sync_status():
    res = client.get("/api/sync/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert data["sync_protocol"] == "v1.0"
    assert "products" in data["supported_entities"]

def test_batch_sync_products_and_decisions():
    # 1. First get existing products to have a product to update price for
    prod_res = client.get("/api/products")
    assert prod_res.status_code == 200
    existing_prods = prod_res.json()
    assert len(existing_prods) > 0
    target_prod = existing_prods[0]
    target_id = target_prod["id"]
    original_price = target_prod["price"]

    # 2. Prepare batch payload with 1 offline draft craft + 1 offline price decision
    batch_payload = {
        "client_sync_timestamp": "2026-09-06T01:30:00Z",
        "products": [
            {
                "client_temp_id": "draft_local_9999",
                "title": "Offline Created Dokra Brass Tribal Deer",
                "description": "Lost-wax cast dokra brass figurine handcrafted in rural Bastar cluster during internet outage.",
                "craft_story": "Centuries-old non-ferrous casting method passed down through 5 generations of tribal metallurgists.",
                "category": "Dokra",
                "materials": "Brass, clay core, beeswax",
                "price": 1850.0,
                "stock": 3,
                "image_url": "https://images.unsplash.com/photo-1590736969955-71cc94801759?w=400",
                "status": "PUBLISHED",
                "material_cost": 450.0,
                "labour_cost": 650.0,
                "packaging_cost": 100.0,
                "min_margin_pct": 0.25
            }
        ],
        "price_decisions": [
            {
                "product_id": target_id,
                "decision": "ACCEPT",
                "recommended_price": original_price + 150.0,
                "previous_price": original_price,
                "demand_factor": 1.10,
                "market_adjustment": 1.02,
                "reasoning_summary": "Approved locally during cluster festival demand surge"
            }
        ]
    }

    # 3. Post to batch sync endpoint
    sync_res = client.post("/api/sync/batch", json=batch_payload)
    assert sync_res.status_code == 200
    sync_data = sync_res.json()

    assert sync_data["status"] == "success"
    assert sync_data["total_items_synced"] == 2
    assert len(sync_data["products_synced"]) == 1
    assert sync_data["products_synced"][0]["client_temp_id"] == "draft_local_9999"
    new_server_id = sync_data["products_synced"][0]["server_id"]
    assert new_server_id > 0

    assert len(sync_data["price_decisions_synced"]) == 1
    assert sync_data["price_decisions_synced"][0]["applied_price"] == original_price + 150.0

    # 4. Verify the newly created product is queryable
    get_new_prod = client.get(f"/api/products/{new_server_id}")
    assert get_new_prod.status_code == 200
    assert get_new_prod.json()["title"] == "Offline Created Dokra Brass Tribal Deer"
    assert get_new_prod.json()["category"] == "Dokra"
    assert get_new_prod.json()["price"] == 1850.0

    # 5. Verify the price was updated on target product
    get_updated_target = client.get(f"/api/products/{target_id}")
    assert get_updated_target.status_code == 200
    assert get_updated_target.json()["price"] == original_price + 150.0
