from fastapi.testclient import TestClient
from backend.app.main import app
from unittest.mock import patch, AsyncMock
from decimal import Decimal

client = TestClient(app)

import uuid

MOCK_DRAFT = {
    "title": "మచిలీపట్నం కలంకారి చీర",
    "description": "హస్తకళా నిపుణుడు చేసిన కలంకారి చీర, సహజ రంగులు వాడబడ్డాయి.",
    "craft_story": "ఈ చీర మచిలీపట్నం సంప్రదాయ కళాకారుడు చేతితో వేసిన అందమైన కలంకారి చిత్రాలతో అలంకరించబడింది.",
    "title_en": "Machilipatnam Kalamkari Saree",
    "description_en": "A handcrafted Kalamkari saree made with natural vegetable dyes.",
    "craft_story_en": "This saree is adorned with hand-painted Kalamkari artwork by a traditional Machilipatnam artisan.",
    "category": "Kalamkari",
    "materials": "Pure Cotton, Natural Vegetable Dyes",
    "tags": ["kalamkari", "handmade", "natural-dyes", "andhra-pradesh"],
    "translations": None,
    "material_cost": 490.0,
    "labour_cost": 450.0,
    "packaging_cost": 60.0,
    "other_cost": 0.0,
    "min_margin_pct": 0.20,
    "min_fair_price": 1200.0,   # (490+450+60) * 1.20 = 1200
    "suggested_price": 1500.0,
    "image_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "enhanced_image_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "source": "DEMO_FALLBACK",
    "transcription": "ఇది మచిలీపట్నం కలంకారి చేతితో వేసిన చీర",
    "language_detected": "te",
    "lifecycle_state": "AI_DRAFT_PENDING_ARTISAN_REVIEW",
    "notice": "This is a test mock draft.",
    "tags_en": ["kalamkari", "handmade", "natural-dyes", "andhra-pradesh"],
    "processing_metadata": {}
}

def test_ai_catalog_pipeline_and_approval():
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"Step3 Seller {uid}",
        "email": f"step3.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # 1. Process Voice & Image into AI Catalog Draft (mocked to avoid live Gemini call)
    req_payload = {
        "voice_description": "ఇది మచిలీపట్నం కలంకారి చేతితో వేసిన చీర, సహజ కూరగాయల రంగులు వాడాము",
        "language": "te",
        "image_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "material_cost": 490.0,
        "labour_cost": 450.0,
        "packaging_cost": 60.0
    }

    with patch(
        "backend.app.routes.ai_catalog.generate_catalog_draft",
        new=AsyncMock(return_value=MOCK_DRAFT)
    ):
        ai_res = client.post("/api/ai/process-catalog", json=req_payload, headers=headers)

    assert ai_res.status_code == 200, ai_res.text
    draft = ai_res.json()

    # Verify response schema and source indicator
    assert draft["source"] in ["LIVE_AI", "LIVE AI", "MANUAL_DRAFT", "DEMO_FALLBACK"]
    assert len(draft["title"]) > 3
    assert len(draft["category"]) > 0
    if draft["source"] in ["LIVE_AI", "LIVE AI", "DEMO_FALLBACK"]:
        assert len(draft["materials"]) > 0
        assert len(draft["craft_story"]) > 10
        assert len(draft["tags"]) >= 2
    else:
        assert isinstance(draft["materials"], str)
        assert isinstance(draft["craft_story"], str)
        assert isinstance(draft["tags"], list)

    # Verify deterministic pricing boundary
    mat = Decimal(str(draft["material_cost"]))
    lab = Decimal(str(draft["labour_cost"]))
    pkg = Decimal(str(draft["packaging_cost"]))
    cost_basis = mat + lab + pkg
    expected_min_fair = (cost_basis * Decimal("1.20")).quantize(Decimal("1"))
    min_fair = Decimal(str(draft["min_fair_price"])).quantize(Decimal("1"))
    assert min_fair == expected_min_fair
    assert Decimal(str(draft["suggested_price"])) >= min_fair

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
    publish_res = client.post("/api/ai/approve-and-publish", json=approved_payload, headers=headers)
    assert publish_res.status_code == 201, publish_res.text
    published = publish_res.json()
    assert published["title"] == approved_payload["title"]
    assert published["status"] == "PUBLISHED"

    # 3. Verify it is queryable in catalog
    list_res = client.get("/api/products")
    assert list_res.status_code == 200
    product_titles = [p["title"] for p in list_res.json()]
    assert approved_payload["title"] in product_titles
