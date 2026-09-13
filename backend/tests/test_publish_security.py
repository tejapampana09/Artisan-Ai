import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_server_owned_draft_token_provenance():
    """Verify that catalog approval requires a valid server-owned draft token."""
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"Provenance User {uid}",
        "email": f"provenance.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/ai/approve-and-publish", json={
        "draft_token": "fake_unregistered_token_12345",
        "title": "Unapproved Product",
        "category": "Pottery",
        "price": 500.0
    }, headers=headers)
    assert res.status_code == 403
    assert "invalid draft token" in res.json()["detail"].lower()


def test_sync_price_decision_ownership_authorization():
    """
    Verify Seller A cannot update Seller B's product price via sync endpoint.
    Sync endpoint returns HTTP 200 with per-item status REJECTED_UNAUTHORIZED.
    Product price remains unchanged. Real owner (Seller B) CAN update.
    """
    uid = uuid.uuid4().hex[:6]

    # Register Seller B (Owner)
    seller_b_reg = client.post("/api/auth/register", json={
        "name": f"Seller B {uid}",
        "email": f"sellerb.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token_b = seller_b_reg.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Register Seller A (Attacker)
    seller_a_reg = client.post("/api/auth/register", json={
        "name": f"Seller A {uid}",
        "email": f"sellera.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token_a = seller_a_reg.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

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
    prod_data = prod_res.json()
    pid = prod_data["id"]

    # Seller A attempts to sync price decision on Seller B's product
    sync_res = client.post("/api/sync/batch", json={
        "price_decisions": [
            {
                "product_id": pid,
                "decision": "ACCEPT",
                "recommended_price": 1500.0,
                "previous_price": 1000.0,
                "created_at_client": "2026-03-01T12:00:00Z"
            }
        ]
    }, headers=headers_a)
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert sync_data["price_decisions_synced"][0]["status"] == "REJECTED_UNAUTHORIZED"

    # Verify Seller B's product price remains ₹1000
    check_res = client.get(f"/api/products/{pid}")
    assert check_res.status_code == 200
    assert float(check_res.json()["price"]) == 1000.0

    # Real owner (Seller B) CAN update price
    owner_sync = client.post("/api/sync/batch", json={
        "price_decisions": [
            {
                "product_id": pid,
                "decision": "ACCEPT",
                "recommended_price": 1200.0,
                "previous_price": 1000.0,
                "created_at_client": "2026-03-01T12:05:00Z"
            }
        ]
    }, headers=headers_b)
    assert owner_sync.status_code == 200
    assert owner_sync.json()["price_decisions_synced"][0]["status"] == "APPLIED"


def test_seller_cannot_review_own_product():
    """Verify that a seller is forbidden from posting a review on their own product (403 Forbidden)."""
    uid = uuid.uuid4().hex[:6]
    email = f"seller.review.{uid}@artisanai.in"
    reg = client.post("/api/auth/register", json={
        "name": "Review Test Seller",
        "email": email,
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_res = client.post("/api/products", json={
        "title": "Self Review Craft",
        "description": "Testing self review restriction",
        "price": 500.0,
        "category": "Pottery",
        "stock": 5
    }, headers=headers)
    assert create_res.status_code == 201
    pid = create_res.json()["id"]

    rev_res = client.post(f"/api/products/{pid}/reviews", json={
        "rating": 5,
        "comment": "Attempting self review!"
    }, headers=headers)
    assert rev_res.status_code == 403
    assert "cannot review their own" in rev_res.json()["detail"].lower()


def test_draft_token_cannot_be_replayed():
    """Verify that a draft catalog token cannot be published twice (one-time consumption enforced)."""
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"Replay Seller {uid}",
        "email": f"replay.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Generate draft catalog
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
    }, headers=headers)
    assert draft_res.status_code == 200
    draft_token = draft_res.json()["draft_token"]

    # First publish attempt -> 201 Created
    pub1 = client.post("/api/ai/approve-and-publish", json={
        "draft_token": draft_token,
        "title": "Teak Wood Chair",
        "category": "Woodwork",
        "materials": "Teak Wood",
        "price": 1000.0
    }, headers=headers)
    assert pub1.status_code == 201

    # Second publish attempt using same draft token -> 400 Bad Request
    pub2 = client.post("/api/ai/approve-and-publish", json={
        "draft_token": draft_token,
        "title": "Teak Wood Chair",
        "category": "Woodwork",
        "materials": "Teak Wood",
        "price": 1000.0
    }, headers=headers)
    assert pub2.status_code == 400
    assert "already been consumed" in pub2.json()["detail"].lower()


def test_publish_sanitizes_english_and_translation_fields():
    """Verify that publish endpoint rejects unverified heritage claims in English and translation fields, and forces status = PUBLISHED."""
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"Lang Seller {uid}",
        "email": f"lang.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

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
    }, headers=headers)
    assert draft_res.status_code == 200
    draft_token = draft_res.json()["draft_token"]

    # Attempt to publish with fabricated heritage claim in craft_story_en -> 400 Bad Request
    pub_fail = client.post("/api/ai/approve-and-publish", json={
        "draft_token": draft_token,
        "title": "Terracotta Pot",
        "category": "Pottery",
        "materials": "Clay",
        "price": 400.0,
        "craft_story_en": "Made by three generations of master artisans with 20 years of family tradition.",
        "status": "DRAFT"
    }, headers=headers)
    assert pub_fail.status_code == 400
    assert "unverified family heritage claim" in pub_fail.json()["detail"].lower()

    # Publish with clean English text -> 201 Created with forced status = PUBLISHED
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
    }, headers=headers)
    assert pub_ok.status_code == 201
    prod = pub_ok.json()
    assert prod["status"] == "PUBLISHED"
    assert prod["craft_story_en"] == "Handcrafted by local artisan."


def test_postgresql_schema_migration_sql_compatibility():
    """Verify that ensure_schema_migrations runs cleanly and SQL migration file contains valid PostgreSQL statement."""
    import os
    from backend.app.database import engine, ensure_schema_migrations
    ensure_schema_migrations(engine)

    migration_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "migrations", "001_add_is_consumed_to_draft_catalogs.sql")
    assert os.path.exists(migration_file)
    with open(migration_file, "r", encoding="utf-8") as f:
        content = f.read()
    assert "ALTER TABLE draft_catalogs" in content
    assert "ADD COLUMN IF NOT EXISTS is_consumed" in content
    assert "DEFAULT FALSE" in content



