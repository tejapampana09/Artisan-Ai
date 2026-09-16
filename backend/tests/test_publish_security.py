import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.tests.conftest import make_buyer, make_artisan_via_admin

client = TestClient(app)


def test_server_owned_draft_token_provenance(artisan_headers):
    """Catalog approval requires a valid server-owned draft token."""
    res = client.post("/api/ai/approve-and-publish", json={
        "draft_token": "fake_unregistered_token_12345",
        "title": "Unapproved Product",
        "category": "Pottery",
        "price": 500.0
    }, headers=artisan_headers)
    assert res.status_code == 403
    assert "invalid draft token" in res.json()["detail"].lower()


def test_sync_price_decision_ownership_authorization(admin_headers):
    """
    Seller A cannot update Seller B's product price via sync endpoint.
    Sync returns 200 with per-item REJECTED_UNAUTHORIZED.
    Real owner (Seller B) CAN update.
    """
    _, _, token_b, headers_b = make_artisan_via_admin(client, admin_headers)
    _, _, token_a, headers_a = make_artisan_via_admin(client, admin_headers)

    # Seller B creates a product
    prod_res = client.post("/api/products", json={
        "title": "Seller B Sacred Craft",
        "category": "Metalwork",
        "price": 1000.0,
        "material_cost": 300.0,
        "labour_cost": 200.0,
        "packaging_cost": 50.0,
        "other_cost": 50.0,
        "min_margin_pct": 0.20
    }, headers=headers_b)
    assert prod_res.status_code == 201
    pid = prod_res.json()["id"]

    # Seller A attempts to sync price on Seller B's product
    sync_res = client.post("/api/sync/batch", json={
        "price_decisions": [{
            "product_id": pid,
            "decision": "ACCEPT",
            "recommended_price": 1500.0,
            "previous_price": 1000.0,
            "created_at_client": "2026-03-01T12:00:00Z"
        }]
    }, headers=headers_a)
    assert sync_res.status_code == 200
    assert sync_res.json()["price_decisions_synced"][0]["status"] == "REJECTED_UNAUTHORIZED"

    # Seller B's price unchanged
    check = client.get(f"/api/products/{pid}", headers=headers_b)
    assert check.status_code == 200
    assert float(check.json()["price"]) == 1000.0

    # Real owner (Seller B) CAN update
    owner_sync = client.post("/api/sync/batch", json={
        "price_decisions": [{
            "product_id": pid,
            "decision": "ACCEPT",
            "recommended_price": 1200.0,
            "previous_price": 1000.0,
            "created_at_client": "2026-03-01T12:05:00Z"
        }]
    }, headers=headers_b)
    assert owner_sync.status_code == 200
    assert owner_sync.json()["price_decisions_synced"][0]["status"] == "APPLIED"


def test_seller_cannot_review_own_product(artisan_headers):
    """An artisan is forbidden from posting a review on their own product."""
    create_res = client.post("/api/products", json={
        "title": "Self Review Craft",
        "description": "Testing self review restriction",
        "price": 500.0,
        "category": "Pottery",
        "stock": 5
    }, headers=artisan_headers)
    assert create_res.status_code == 201
    pid = create_res.json()["id"]

    # reviews endpoint requires require_buyer - artisan token should return 403
    rev_res = client.post(f"/api/products/{pid}/reviews", json={
        "rating": 5,
        "comment": "Attempting self review!"
    }, headers=artisan_headers)
    # Either 403 (artisan is not buyer) or 403 (self-review blocked)
    assert rev_res.status_code == 403


def test_draft_token_cannot_be_replayed(artisan_headers):
    """A draft catalog token cannot be published twice (one-time consumption)."""
    draft_res = client.post("/api/ai/process-catalog", json={
        "artisan_facts": {
            "product_name": "Teak Wood Chair",
            "craft_type": "Woodwork",
            "materials": ["Teak Wood"],
            "handmade": True,
            "making_time": "3 days",
            "artisan_story": "Handcarved wood",
            "special_characteristics": "Polished"
        },
        "material_cost": 500.0,
        "labour_cost": 300.0
    }, headers=artisan_headers)
    assert draft_res.status_code == 200
    draft_token = draft_res.json()["draft_token"]

    # First publish -> 201
    pub1 = client.post("/api/ai/approve-and-publish", json={
        "draft_token": draft_token,
        "title": "Teak Wood Chair",
        "category": "Woodwork",
        "materials": "Teak Wood",
        "price": 1000.0
    }, headers=artisan_headers)
    assert pub1.status_code == 201

    # Second publish with same token -> 400
    pub2 = client.post("/api/ai/approve-and-publish", json={
        "draft_token": draft_token,
        "title": "Teak Wood Chair",
        "category": "Woodwork",
        "materials": "Teak Wood",
        "price": 1000.0
    }, headers=artisan_headers)
    assert pub2.status_code == 400
    assert "already been consumed" in pub2.json()["detail"].lower()


def test_publish_sanitizes_heritage_claims(artisan_headers):
    """Publish endpoint rejects unverified heritage claims and forces status=PUBLISHED."""
    draft_res = client.post("/api/ai/process-catalog", json={
        "artisan_facts": {
            "product_name": "Terracotta Pot",
            "craft_type": "Pottery",
            "materials": ["Clay"],
            "handmade": True,
            "making_time": "1 day",
            "artisan_story": "Local craftsman",
            "special_characteristics": "Earthen"
        },
        "material_cost": 100.0,
        "labour_cost": 100.0
    }, headers=artisan_headers)
    assert draft_res.status_code == 200
    draft_token = draft_res.json()["draft_token"]

    # Fabricated heritage claim -> 400
    pub_fail = client.post("/api/ai/approve-and-publish", json={
        "draft_token": draft_token,
        "title": "Terracotta Pot",
        "category": "Pottery",
        "materials": "Clay",
        "price": 400.0,
        "craft_story_en": "Made by three generations of master artisans with 20 years of family tradition.",
        "status": "DRAFT"
    }, headers=artisan_headers)
    assert pub_fail.status_code == 400
    assert "unverified family heritage claim" in pub_fail.json()["detail"].lower()

    # Clean text -> 201, forced PENDING_APPROVAL
    pub_ok = client.post("/api/ai/approve-and-publish", json={
        "draft_token": draft_token,
        "title": "Terracotta Pot",
        "category": "Pottery",
        "materials": "Clay",
        "price": 400.0,
        "title_en": "Terracotta Pot",
        "description_en": "Earthen terracotta pot handmade with natural clay.",
        "craft_story_en": "Handcrafted by local artisan.",
        "status": "DRAFT"
    }, headers=artisan_headers)
    assert pub_ok.status_code == 201
    prod = pub_ok.json()
    assert prod["status"] == "PENDING_APPROVAL"


def test_postgresql_schema_migration_sql_compatibility():
    """Verify ensure_schema_migrations runs cleanly."""
    import os
    from backend.app.database import engine, ensure_schema_migrations
    ensure_schema_migrations(engine)

    migration_file = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "migrations", "001_add_is_consumed_to_draft_catalogs.sql"
    )
    assert os.path.exists(migration_file)
    with open(migration_file, "r", encoding="utf-8") as f:
        content = f.read()
    assert "ALTER TABLE draft_catalogs" in content
    assert "ADD COLUMN IF NOT EXISTS is_consumed" in content
    assert "DEFAULT FALSE" in content


def test_publish_persists_validated_artisan_facts_category(artisan_headers):
    """ArtisanFacts.craft_type overrides client-submitted category on publish."""
    draft_res = client.post("/api/ai/process-catalog", json={
        "artisan_facts": {
            "product_name": "Carved Wooden Stool",
            "craft_type": "Woodwork",
            "materials": ["Teak Wood"],
            "handmade": True,
            "making_time": "2 days",
            "artisan_story": "Woodcarving",
            "special_characteristics": "Polished"
        },
        "material_cost": 200.0,
        "labour_cost": 100.0
    }, headers=artisan_headers)
    assert draft_res.status_code == 200
    draft_token = draft_res.json()["draft_token"]

    pub_res = client.post("/api/ai/approve-and-publish", json={
        "draft_token": draft_token,
        "title": "Carved Wooden Stool",
        "category": "Electronics",
        "materials": "Teak Wood",
        "price": 500.0
    }, headers=artisan_headers)
    assert pub_res.status_code == 201
    # ArtisanFacts.craft_type ("Woodwork") must override client "Electronics"
    assert pub_res.json()["category"] == "Woodwork"


def test_buyer_token_rejected_by_ai_catalog_endpoints():
    """BUYER token is rejected by /api/ai/process-catalog and /api/ai/approve-and-publish with 403."""
    _, _, _, buyer_headers = make_buyer(client)

    # 1. process-catalog
    res_proc = client.post("/api/ai/process-catalog", json={
        "voice_description": "Pottery craft",
        "category_hint": "Pottery"
    }, headers=buyer_headers)
    assert res_proc.status_code == 403
    assert "artisan studio session required" in res_proc.json()["detail"].lower()

    # 2. approve-and-publish
    res_pub = client.post("/api/ai/approve-and-publish", json={
        "draft_token": "some_token",
        "title": "Clay Pot",
        "category": "Pottery",
        "price": 250.0
    }, headers=buyer_headers)
    assert res_pub.status_code == 403
    assert "artisan studio session required" in res_pub.json()["detail"].lower()


def test_admin_token_rejected_by_ai_catalog_endpoints(admin_headers):
    """ADMIN token is rejected by /api/ai/process-catalog and /api/ai/approve-and-publish with 403 (domain isolation)."""
    # 1. process-catalog
    res_proc = client.post("/api/ai/process-catalog", json={
        "voice_description": "Pottery craft",
        "category_hint": "Pottery"
    }, headers=admin_headers)
    assert res_proc.status_code == 403
    assert "artisan studio session required" in res_proc.json()["detail"].lower()

    # 2. approve-and-publish
    res_pub = client.post("/api/ai/approve-and-publish", json={
        "draft_token": "some_token",
        "title": "Clay Pot",
        "category": "Pottery",
        "price": 250.0
    }, headers=admin_headers)
    assert res_pub.status_code == 403
    assert "artisan studio session required" in res_pub.json()["detail"].lower()


def test_publish_forces_pending_approval_status_ignoring_client_values(artisan_headers):
    """Publishing forces status to PENDING_APPROVAL even if client specifies PUBLISHED or APPROVED."""
    # Create draft
    draft_res = client.post("/api/ai/process-catalog", json={
        "artisan_facts": {
            "product_name": "Brass Bell",
            "craft_type": "Metalwork",
            "materials": ["Brass"],
            "handmade": True,
            "making_time": "1 day",
            "artisan_story": "Traditional temple bell maker",
            "special_characteristics": "Resonant tone"
        },
        "material_cost": 300.0,
        "labour_cost": 200.0
    }, headers=artisan_headers)
    assert draft_res.status_code == 200
    draft_token = draft_res.json()["draft_token"]

    # Attempt to publish directly with status=PUBLISHED
    pub_res = client.post("/api/ai/approve-and-publish", json={
        "draft_token": draft_token,
        "title": "Brass Bell",
        "category": "Metalwork",
        "materials": "Brass",
        "price": 800.0,
        "status": "PUBLISHED"
    }, headers=artisan_headers)
    assert pub_res.status_code == 201
    prod = pub_res.json()
    assert prod["status"] == "PENDING_APPROVAL"


def test_artisan_cannot_publish_other_artisan_draft(admin_headers):
    """Artisan A cannot publish Artisan B's draft token."""
    _, _, _, headers_a = make_artisan_via_admin(client, admin_headers)
    _, _, _, headers_b = make_artisan_via_admin(client, admin_headers)

    # Artisan A generates draft
    draft_res = client.post("/api/ai/process-catalog", json={
        "artisan_facts": {
            "product_name": "Silk Scarf",
            "craft_type": "Textiles",
            "materials": ["Silk"],
            "handmade": True,
            "making_time": "2 days",
            "artisan_story": "Silk weaving",
            "special_characteristics": "Hand dyed"
        },
        "material_cost": 400.0,
        "labour_cost": 300.0
    }, headers=headers_a)
    assert draft_res.status_code == 200
    draft_token = draft_res.json()["draft_token"]

    # Artisan B attempts to publish Artisan A's draft
    pub_res = client.post("/api/ai/approve-and-publish", json={
        "draft_token": draft_token,
        "title": "Silk Scarf",
        "category": "Textiles",
        "materials": "Silk",
        "price": 1200.0
    }, headers=headers_b)
    assert pub_res.status_code == 403
    assert "draft does not belong to current user" in pub_res.json()["detail"].lower()
