import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

# =====================================================================
# 1. PASSWORD SECURITY TESTS
# =====================================================================

def test_unauthenticated_password_change_rejected():
    """Verify that /api/auth/change-password requires a valid Bearer token."""
    res = client.post("/api/auth/change-password", json={
        "current_password": "SomePassword123!",
        "new_password": "NewPassword123!"
    })
    assert res.status_code == 401

def test_incorrect_current_password_rejected():
    """Verify that change-password fails with 400 if current_password is wrong."""
    uid = uuid.uuid4().hex[:6]
    email = f"pwd.test.{uid}@artisanai.in"
    reg = client.post("/api/auth/register", json={
        "name": "Password Test User",
        "email": email,
        "password": "CorrectPassword123!",
        "role": "ARTISAN"
    })
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/auth/change-password", json={
        "current_password": "WrongPassword999!",
        "new_password": "NewPassword123!"
    }, headers=headers)
    assert res.status_code == 400
    assert "incorrect" in res.json()["detail"].lower()

def test_authenticated_user_changes_own_password():
    """Verify user can change own password with correct current_password."""
    uid = uuid.uuid4().hex[:6]
    email = f"pwd.owner.{uid}@artisanai.in"
    reg = client.post("/api/auth/register", json={
        "name": "Password Owner Test",
        "email": email,
        "password": "InitialPassword123!",
        "role": "ARTISAN"
    })
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Change password
    change_res = client.post("/api/auth/change-password", json={
        "current_password": "InitialPassword123!",
        "new_password": "UpdatedPassword456!"
    }, headers=headers)
    assert change_res.status_code == 200
    assert "access_token" in change_res.json()

    # Login with new password works
    new_login = client.post("/api/auth/login", json={
        "email_or_phone": email,
        "password": "UpdatedPassword456!"
    })
    assert new_login.status_code == 200

    # Old password no longer works
    old_login = client.post("/api/auth/login", json={
        "email_or_phone": email,
        "password": "InitialPassword123!"
    })
    assert old_login.status_code == 401

def test_public_reset_password_returns_501():
    """Verify that public /api/auth/reset-password endpoint returns 501 Not Implemented."""
    res = client.post("/api/auth/reset-password", json={
        "email_or_phone": "anyuser@artisanai.in",
        "new_password": "NewPassword123!"
    })
    assert res.status_code == 501
    assert "not available" in res.json()["detail"].lower()


# =====================================================================
# 2. SYNC OWNERSHIP AUTHORIZATION TESTS
# =====================================================================

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
        "email": f"seller.b.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token_b = seller_b_reg.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Seller B creates a product priced at 1000.0
    prod_res = client.post("/api/products", json={
        "title": f"Bastar Bell Metal {uid}",
        "category": "Metal Crafts",
        "price": 1000.0,
        "stock": 10
    }, headers=headers_b)
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # Register Seller A (Attacker / Unauthorized user)
    seller_a_reg = client.post("/api/auth/register", json={
        "name": f"Seller A {uid}",
        "email": f"seller.a.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token_a = seller_a_reg.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Seller A attempts to update Seller B's product price via batch sync
    sync_payload = {
        "price_decisions": [
            {
                "product_id": prod_id,
                "decision": "ACCEPT",
                "recommended_price": 50.0,
                "previous_price": 1000.0
            }
        ]
    }
    sync_res = client.post("/api/sync/batch", json=sync_payload, headers=headers_a)
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert len(sync_data["price_decisions_synced"]) == 1
    item_result = sync_data["price_decisions_synced"][0]
    assert item_result["product_id"] == prod_id
    assert item_result["status"] == "REJECTED_UNAUTHORIZED"

    # Verify price of Seller B's product was NOT changed
    get_prod = client.get(f"/api/products/{prod_id}")
    assert get_prod.status_code == 200
    assert float(get_prod.json()["price"]) == 1000.0

    # Seller B (real owner) syncs a price decision → APPLIED
    sync_res_b = client.post("/api/sync/batch", json={
        "price_decisions": [
            {
                "product_id": prod_id,
                "decision": "ACCEPT",
                "recommended_price": 1200.0,
                "previous_price": 1000.0
            }
        ]
    }, headers=headers_b)
    assert sync_res_b.status_code == 200
    b_item_result = sync_res_b.json()["price_decisions_synced"][0]
    assert b_item_result["status"] == "APPLIED"
    assert b_item_result["applied_price"] == 1200.0

    # Verify price updated in DB
    get_prod_after = client.get(f"/api/products/{prod_id}")
    assert float(get_prod_after.json()["price"]) == 1200.0

def test_sync_nonexistent_product_skipped():
    """Verify sync handling for a non-existent product ID returns SKIPPED_NOT_FOUND."""
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"Sync User {uid}",
        "email": f"sync.user.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    res = client.post("/api/sync/batch", json={
        "price_decisions": [
            {
                "product_id": 999999,
                "decision": "ACCEPT",
                "recommended_price": 500.0,
                "previous_price": 400.0
            }
        ]
    }, headers=headers)
    assert res.status_code == 200
    item = res.json()["price_decisions_synced"][0]
    assert item["status"] == "SKIPPED_NOT_FOUND"


# =====================================================================
# 3. IMAGE INTEGRITY TESTS
# =====================================================================

def test_create_product_without_image_does_not_contain_unsplash():
    """Verify creating a product without image does not store Unsplash stock image URLs."""
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"Image User {uid}",
        "email": f"img.user.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    res = client.post("/api/products", json={
        "title": f"Handmade Wooden Comb {uid}",
        "category": "Wooden Craft",
        "price": 150.0,
        "stock": 5,
        "image_url": None
    }, headers=headers)
    assert res.status_code == 201
    prod_data = res.json()
    assert prod_data["image_url"] is None or prod_data["image_url"] == ""
    assert "unsplash" not in (prod_data["image_url"] or "").lower()

def test_create_product_with_custom_image_preserved():
    """Verify custom user-provided image URL is preserved."""
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"Image User {uid}",
        "email": f"img.user2.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    custom_url = "https://cdn.artisanai.in/my_handicraft.jpg"
    res = client.post("/api/products", json={
        "title": f"Kalamkari Painting {uid}",
        "category": "Kalamkari",
        "price": 500.0,
        "stock": 2,
        "image_url": custom_url
    }, headers=headers)
    assert res.status_code == 201
    assert res.json()["image_url"] == custom_url


# =====================================================================
# 4. AI PRODUCTION PURITY TESTS
# =====================================================================

def test_ai_catalog_does_not_invent_fabricated_heritage_claims():
    """
    Verify AI catalog route does not replace empty input with fabricated strings
    like 'Authentic handcrafted heritage creation'.
    """
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"AI User {uid}",
        "email": f"ai.user.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    res = client.post("/api/ai/process-catalog", json={
        "voice_description": "Small clay lamp for Diwali",
        "language": "en"
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "Authentic handcrafted heritage creation" not in data.get("description", "")
    assert "Authentic handcrafted heritage creation" not in data.get("craft_story", "")


# =====================================================================
# 5. REGISTRATION HARDENING TESTS
# =====================================================================

def test_registration_requires_email_or_phone():
    """Verify registration fails with 400 if neither email nor phone is provided."""
    res = client.post("/api/auth/register", json={
        "name": "No Contact User",
        "email": "   ",
        "phone": "",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    assert res.status_code == 400
    assert "at least an email address or phone number" in res.json()["detail"]

def test_registration_strips_whitespace_and_normalizes():
    """Verify whitespace is trimmed and email is lowercased during registration."""
    uid = uuid.uuid4().hex[:6]
    raw_email = f"  TEST.USER.{uid}@ArtisanAI.in  "
    reg = client.post("/api/auth/register", json={
        "name": "  Whitespace User  ",
        "email": raw_email,
        "password": "Password123!",
        "role": "ARTISAN"
    })
    assert reg.status_code == 201
    user_data = reg.json()["user"]
    assert user_data["email"] == f"test.user.{uid}@artisanai.in"
    assert user_data["name"] == "Whitespace User"

def test_registration_differentiates_duplicate_email_or_phone():
    """Verify duplicate registration provides specific error messages for email and phone."""
    uid = uuid.uuid4().hex[:6]
    email = f"dup.{uid}@artisanai.in"
    phone = f"+91987{uid[:5]}"

    # Initial registration
    reg = client.post("/api/auth/register", json={
        "name": "First User",
        "email": email,
        "phone": phone,
        "password": "Password123!",
        "role": "ARTISAN"
    })
    assert reg.status_code == 201

    # Duplicate email
    dup_email = client.post("/api/auth/register", json={
        "name": "Second User",
        "email": email,
        "password": "Password123!",
        "role": "ARTISAN"
    })
    assert dup_email.status_code == 400
    assert "email address is already registered" in dup_email.json()["detail"]

    # Duplicate phone
    dup_phone = client.post("/api/auth/register", json={
        "name": "Third User",
        "phone": phone,
        "password": "Password123!",
        "role": "ARTISAN"
    })
    assert dup_phone.status_code == 400
    assert "phone number is already registered" in dup_phone.json()["detail"]

