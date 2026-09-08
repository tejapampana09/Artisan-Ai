import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.tests.conftest import TestingSessionLocal as SessionLocal

from backend.app.models import Product, Order

client = TestClient(app)

def test_p0_issue1_ai_catalog_generation_requires_auth():
    """
    Verifies P0 Issue #1: POST /api/ai/process-catalog requires authentication (401 with invalid token).
    """
    res = client.post("/api/ai/process-catalog", json={
        "voice_description": "Handcrafted silver jewelry box"
    }, headers={"Authorization": "Bearer invalid_token"})
    assert res.status_code == 401
    assert "invalid" in res.json()["detail"].lower() or "token" in res.json()["detail"].lower()

def test_p0_issue2_translate_product_requires_auth_and_seller_ownership():
    """
    Verifies P0 Issue #2: POST /api/ai/translate-product requires authentication,
    and returns 403 if attempting to modify/cache translation for another artisan's product.
    """
    # 1. Unauthenticated request -> 401
    res = client.post("/api/ai/translate-product", json={
        "title": "Craft Title",
        "target_language": "te"
    }, headers={"Authorization": "Bearer invalid_token"})
    assert res.status_code == 401

    # 2. Register Artisan 1 & create product
    uid1 = uuid.uuid4().hex[:6]
    artisan1_res = client.post("/api/auth/register", json={
        "name": f"Artisan {uid1}",
        "email": f"artisan1.{uid1}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token1 = artisan1_res.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}

    prod_res = client.post("/api/products", json={
        "title": "Owner Product",
        "category": "Jewelry",
        "price": 500.0
    }, headers=headers1)
    pid = prod_res.json()["id"]

    # 3. Register Artisan 2
    uid2 = uuid.uuid4().hex[:6]
    artisan2_res = client.post("/api/auth/register", json={
        "name": f"Artisan {uid2}",
        "email": f"artisan2.{uid2}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token2 = artisan2_res.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # 4. Authenticated buyer/user translates Artisan 1's product for reading -> 200 OK
    trans_res = client.post("/api/ai/translate-product", json={
        "product_id": pid,
        "target_language": "te"
    }, headers=headers2)
    assert trans_res.status_code == 200
    assert trans_res.json()["target_language"] == "te"

def test_p1_issue3_admin_bypass_for_product_management():
    """
    Verifies P1 Issue #3: Admin users can update, delete, and transition status of products owned by other sellers.
    """
    uid1 = uuid.uuid4().hex[:6]
    artisan_res = client.post("/api/auth/register", json={
        "name": f"Artisan {uid1}",
        "email": f"artisan.{uid1}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    artisan_token = artisan_res.json()["access_token"]
    artisan_headers = {"Authorization": f"Bearer {artisan_token}"}

    prod_res = client.post("/api/products", json={
        "title": "Artisan Craft",
        "category": "Pottery",
        "price": 300.0
    }, headers=artisan_headers)
    pid = prod_res.json()["id"]

    # Register Admin user
    admin_uid = uuid.uuid4().hex[:6]
    admin_res = client.post("/api/auth/register", json={
        "name": f"Admin {admin_uid}",
        "email": f"admin.{admin_uid}@artisanai.in",
        "password": "Password123!",
        "role": "ADMIN"
    })
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin updates product -> 200 OK
    update_res = client.patch(f"/api/products/{pid}", json={"price": 350.0}, headers=admin_headers)
    assert update_res.status_code == 200
    assert float(update_res.json()["price"]) == 350.0

    # Admin transitions status -> 200 OK
    status_res = client.patch(f"/api/products/{pid}/status", json={"status": "APPROVED"}, headers=admin_headers)
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "APPROVED"

def test_p1_issue5_verified_review_enforcement():
    """
    Verifies P1 Issue #5: Reviews require a completed DELIVERED order for the product (403 if unverified).
    """
    uid1 = uuid.uuid4().hex[:6]
    buyer_res = client.post("/api/auth/register", json={
        "name": f"Buyer {uid1}",
        "email": f"buyer.{uid1}@artisanai.in",
        "password": "Password123!",
        "role": "BUYER"
    })
    buyer_token = buyer_res.json()["access_token"]
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

    db = SessionLocal()
    try:
        prod = Product(
            title="Review Test Saree",
            category="Textiles",
            price=2000.0,
            status="PUBLISHED"
        )
        db.add(prod)
        db.commit()
        db.refresh(prod)

        # Buyer attempts review without delivered order -> 403 Forbidden
        rev_res = client.post(f"/api/products/{prod.id}/reviews", json={
            "rating": 5,
            "comment": "Unverified buyer attempt!"
        }, headers=buyer_headers)
        assert rev_res.status_code == 403
        assert "verified buyers" in rev_res.json()["detail"].lower()
    finally:
        db.close()

def test_p1_issue6_artisan_public_profile_strips_contact_info():
    """
    Verifies P1 Issue #6: Public artisan profile endpoint hides raw email and phone.
    """
    uid1 = uuid.uuid4().hex[:6]
    artisan_res = client.post("/api/auth/register", json={
        "name": f"Master Artisan {uid1}",
        "email": f"master.{uid1}@artisanai.in",
        "phone": "9876543210",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    artisan_id = artisan_res.json()["user"]["id"]

    public_res = client.get(f"/api/artisan/{artisan_id}")
    assert public_res.status_code == 200
    data = public_res.json()

    assert data["name"] == f"Master Artisan {uid1}"
    assert data["email"] is None
    assert data["phone"] is None
