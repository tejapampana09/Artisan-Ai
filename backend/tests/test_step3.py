from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_ai_catalog_pipeline_and_approval():
    # 1. Process Voice & Image into AI Catalog Draft
    req_payload = {
        "voice_description": "ఇది మచిలీపట్నం కలంకారి చేతితో వేసిన చీర, సహజ కూరగాయల రంగులు వాడాము",
        "language": "te",
        "image_url": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800",
        "material_cost": 490.0,
        "labour_cost": 450.0,
        "packaging_cost": 60.0
    }
    ai_res = client.post("/api/ai/process-catalog", json=req_payload)
    assert ai_res.status_code == 200
    draft = ai_res.json()

    # Verify response schema and source indicator
    assert draft["source"] in ["LIVE AI", "DEMO FALLBACK"]
    assert len(draft["title"]) > 5
    assert draft["category"] == "Kalamkari"
    assert "Mulberry Silk" in draft["materials"] or len(draft["materials"]) > 3
    assert len(draft["craft_story"]) > 20
    assert len(draft["tags"]) >= 3
    
    # Verify deterministic pricing boundary
    cost_basis = draft["material_cost"] + draft["labour_cost"] + draft["packaging_cost"]
    expected_min_fair = round(cost_basis * 1.20)
    assert draft["min_fair_price"] == expected_min_fair
    assert draft["suggested_price"] >= draft["min_fair_price"]

    # 2. Artisan Review & Human Approval Flow
    approved_payload = {
        "title": draft["title"] + " (Artisan Verified)",
        "category": draft["category"],
        "materials": draft["materials"],
        "description": draft["description"],
        "craft_story": draft["craft_story"],
        "price": draft["suggested_price"],
        "stock": 4,
        "material_cost": draft["material_cost"],
        "labour_cost": draft["labour_cost"],
        "packaging_cost": draft["packaging_cost"],
        "min_margin_pct": draft["min_margin_pct"],
        "image_url": draft["image_url"],
        "enhanced_image_url": draft["enhanced_image_url"],
        "status": "PUBLISHED"
    }
    publish_res = client.post("/api/ai/approve-and-publish", json=approved_payload)
    assert publish_res.status_code == 201
    published = publish_res.json()
    assert published["title"] == approved_payload["title"]
    assert published["status"] == "PUBLISHED"

    # 3. Verify it is queryable in catalog
    list_res = client.get("/api/products")
    assert list_res.status_code == 200
    product_titles = [p["title"] for p in list_res.json()]
    assert approved_payload["title"] in product_titles
