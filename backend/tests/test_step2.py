from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_product_crud_lifecycle():
    # 1. Verify Seed Products exist (GET /api/products)
    res = client.get("/api/products")
    assert res.status_code == 200
    products = res.json()
    assert len(products) >= 4
    categories = [p["category"] for p in products]
    assert "Kalamkari" in categories
    assert "Wooden Toys" in categories

    # 2. Test CREATE (POST /api/products)
    new_payload = {
        "title": "Pochampally Ikat Silk Scarf",
        "description": "Geometrically aligned double-ikat scarf dyed in natural crimson.",
        "craft_story": "Woven on pit looms by master weavers in Bhoodan Pochampally.",
        "category": "Pochampally Ikat",
        "materials": "Pure Silk, Natural Vegetable Dyes",
        "price": 950.0,
        "stock": 10,
        "status": "PUBLISHED",
        "material_cost": 300.0,
        "labour_cost": 350.0,
        "packaging_cost": 50.0,
        "min_margin_pct": 0.20
    }
    create_res = client.post("/api/products", json=new_payload)
    assert create_res.status_code == 201
    created = create_res.json()
    product_id = created["id"]
    assert created["title"] == new_payload["title"]
    assert created["price"] == 950.0

    # 3. Test GET by ID (GET /api/products/{id})
    get_res = client.get(f"/api/products/{product_id}")
    assert get_res.status_code == 200
    assert get_res.json()["category"] == "Pochampally Ikat"

    # 4. Test UPDATE (PATCH /api/products/{id})
    update_res = client.patch(
        f"/api/products/{product_id}",
        json={"price": 1050.0, "stock": 12, "title": "Updated Pochampally Ikat Silk Scarf"}
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["price"] == 1050.0
    assert updated["stock"] == 12
    assert updated["title"] == "Updated Pochampally Ikat Silk Scarf"

    # 5. Test DELETE (DELETE /api/products/{id})
    del_res = client.delete(f"/api/products/{product_id}")
    assert del_res.status_code == 204

    # 6. Verify DELETED (GET /api/products/{id} -> 404)
    verify_res = client.get(f"/api/products/{product_id}")
    assert verify_res.status_code == 404
