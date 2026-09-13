import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas import ArtisanFacts
from backend.app.services.catalog_orchestrator import process_full_catalog_pipeline_sync
from backend.app.services.market_research_provider import MockMarketResearchProvider
from backend.app.routes.ai_catalog import approve_and_publish_product, CatalogApproveRequest
from fastapi import HTTPException

client = TestClient(app)

def test_phase7_1_catalog_orchestrator_pipeline_with_mock_market(db):
    facts = ArtisanFacts(
        product_name="Kondapalli Wooden Horse",
        craft_type="Toys",
        materials=["Teak Wood", "Vegetable Dyes"],
        handmade=True,
        artisan_story="Traditional Kondapalli toy craft from Andhra Pradesh"
    )

    mock_provider = MockMarketResearchProvider(mock_listings=[
        {"title": "Kondapalli Wooden Toy Horse", "category": "Toys", "materials": ["Teak Wood"], "price": 1200.0, "currency": "INR"},
        {"title": "Handcrafted Wooden Horse", "category": "Toys", "materials": ["Teak Wood"], "price": 1400.0, "currency": "INR"}
    ])

    res = process_full_catalog_pipeline_sync(
        artisan_facts=facts,
        material_cost=300.0,
        labour_cost=200.0,
        packaging_cost=50.0,
        other_cost=50.0,
        provider=mock_provider,
        db=db,
        user_id=1
    )

    # 1. Unified Contract fields check
    assert "draft_token" in res
    assert res["draft_token"].startswith("draft_")
    assert "catalog" in res
    assert "artisan_facts" in res
    assert "market_summary" in res
    assert "price_recommendation" in res

    # 2. Catalog & Validation
    assert res["catalog"]["title"] != ""
    assert "Teak Wood" in res["catalog"]["materials"]

    # 3. Market Summary
    assert res["market_summary"]["comparable_count"] == 2
    assert res["market_summary"]["median_price"] == 1300.0

    # 4. Pure Pricing Recommendation
    price_rec = res["price_recommendation"]
    assert price_rec["cost_basis"] == 600.0
    assert price_rec["minimum_fair_price"] == 720.0
    assert price_rec["market_signal_used"] is True
    assert price_rec["market_median"] == 1300.0
    assert price_rec["recommended_price"] > 720.0
    assert len(price_rec["reasoning"]) > 0

def test_phase7_trust_boundary_1_server_owned_draft_token_and_cost_floor(db):
    original_facts = ArtisanFacts(
        product_name="Terracotta Water Jug",
        craft_type="Pottery",
        materials=["Clay", "Terracotta"],
        handmade=True
    )

    # 1. Process catalog generates server-owned DraftCatalog entry
    draft_res = process_full_catalog_pipeline_sync(
        artisan_facts=original_facts,
        material_cost=300.0,
        labour_cost=200.0,
        packaging_cost=50.0,
        other_cost=50.0,
        db=db,
        user_id=1
    )

    draft_token = draft_res["draft_token"]
    assert draft_token.startswith("draft_")

    mock_user = type("User", (), {"id": 1})()

    # 2. Client attempts to lower cost floor by omitting costs and setting price = 500
    # Server uses server-owned cost basis from DraftCatalog (floor ₹720) and rejects 500!
    publish_payload_low_price = {
        "draft_token": draft_token,
        "title": "Terracotta Water Jug",
        "category": "Pottery",
        "materials": "Clay, Terracotta",
        "description": "Handcrafted terracotta jug",
        "craft_story": "Traditional pottery",
        "price": 500.0,
        "material_cost": 0.0, # Client attempts to spoof costs as 0
        "labour_cost": 0.0
    }

    with pytest.raises(HTTPException) as exc_info:
        approve_and_publish_product(CatalogApproveRequest(**publish_payload_low_price), db=db, current_user=mock_user)

    assert exc_info.value.status_code == 400
    assert "below minimum fair price floor" in exc_info.value.detail

    # 3. Client attempts to spoof material to "Clay, Gold Leaf" using valid draft token
    # Server retrieves server-owned facts from DraftCatalog and rejects Gold Leaf with 400!
    publish_payload_spoofed_mat = {
        "draft_token": draft_token,
        "title": "Terracotta Water Jug",
        "category": "Pottery",
        "materials": "Clay, Terracotta, 24K Gold Leaf",
        "description": "Handcrafted terracotta jug",
        "craft_story": "Traditional pottery",
        "price": 850.0
    }

    with pytest.raises(HTTPException) as exc_info:
        approve_and_publish_product(CatalogApproveRequest(**publish_payload_spoofed_mat), db=db, current_user=mock_user)

    assert exc_info.value.status_code == 400
    assert "24K Gold Leaf" in exc_info.value.detail

    # 4. Valid publish using draft_token and verified materials succeeds!
    valid_publish_payload = {
        "draft_token": draft_token,
        "title": "Terracotta Water Jug",
        "category": "Pottery",
        "materials": "Clay, Terracotta",
        "description": "Handcrafted terracotta jug",
        "craft_story": "Traditional pottery",
        "price": 850.0
    }

    published = approve_and_publish_product(CatalogApproveRequest(**valid_publish_payload), db=db, current_user=mock_user)
    assert published.id is not None
    assert published.price == Decimal("850.00")
    # Verify server_min_margin_pct (20%) is stored in Product
    assert published.min_margin_pct == Decimal("0.2000")

def test_phase7_draft_ownership_check_prevents_unauthorized_publish(db):
    user_a_facts = ArtisanFacts(
        product_name="User A Brass Plate",
        craft_type="Brassware",
        materials=["Brass"],
        handmade=True
    )

    # 1. User 1 creates draft catalog
    draft_res = process_full_catalog_pipeline_sync(
        artisan_facts=user_a_facts,
        material_cost=400.0,
        db=db,
        user_id=1
    )
    draft_token = draft_res["draft_token"]

    # 2. User 2 (attacker) attempts to publish User 1's draft_token
    user_b = type("User", (), {"id": 2})()
    user_b_payload = {
        "draft_token": draft_token,
        "title": "User B Stolen Draft",
        "category": "Brassware",
        "materials": "Brass",
        "price": 1000.0
    }

    with pytest.raises(HTTPException) as exc_info:
        approve_and_publish_product(CatalogApproveRequest(**user_b_payload), db=db, current_user=user_b)

    assert exc_info.value.status_code == 403
    assert "belong to current user" in exc_info.value.detail
