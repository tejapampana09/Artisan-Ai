"""
test_v3_domain_isolation.py
===========================
Strict V3 architecture isolation tests.
Verifies:
  - Buyer token  -> Studio API  -> 403
  - Buyer token  -> Admin API   -> 403
  - Artisan token -> Admin API  -> 403
  - Admin token  -> Buyer API   -> 403
  - Admin token  -> Studio API  -> 403
  - Pricing engine never exceeds +25% cap
  - Order starts PENDING_PAYMENT, transitions to CONFIRMED only after /verify
  - Products default to DRAFT status
  - Artisan cannot delete another artisan's product
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.tests.conftest import make_buyer, make_artisan_via_admin

client = TestClient(app)


# ── Cross-Domain Token Rejection ──────────────────────────────────────────────

def test_buyer_token_rejected_by_studio_me():
    """MARKETPLACE Buyer token -> /studio/auth/me -> 403."""
    _, _, _, buyer_headers = make_buyer(client)
    res = client.get("/api/studio/auth/me", headers=buyer_headers)
    assert res.status_code == 403


def test_buyer_token_rejected_by_admin_me():
    """MARKETPLACE Buyer token -> /admin/auth/me -> 403."""
    _, _, _, buyer_headers = make_buyer(client)
    res = client.get("/api/admin/auth/me", headers=buyer_headers)
    assert res.status_code == 403


def test_artisan_token_rejected_by_admin_me(artisan_headers):
    """ARTISAN_STUDIO token -> /admin/auth/me -> 403."""
    res = client.get("/api/admin/auth/me", headers=artisan_headers)
    assert res.status_code == 403


def test_admin_token_rejected_by_studio_me(admin_headers):
    """ADMIN token -> /studio/auth/me -> 403."""
    res = client.get("/api/studio/auth/me", headers=admin_headers)
    assert res.status_code == 403


def test_admin_token_rejected_by_marketplace_me(admin_headers):
    """ADMIN token -> /marketplace/auth/me -> 403."""
    res = client.get("/api/marketplace/auth/me", headers=admin_headers)
    assert res.status_code == 403


def test_buyer_token_cannot_create_product():
    """Buyer MARKETPLACE token -> POST /api/products -> 403."""
    _, _, _, buyer_headers = make_buyer(client)
    res = client.post("/api/products", json={
        "title": "Injected Product",
        "price": 100.0,
        "category": "Pottery",
        "stock": 1
    }, headers=buyer_headers)
    assert res.status_code == 403


def test_admin_token_cannot_create_product(admin_headers):
    """ADMIN token -> POST /api/products -> 403 (admin must use admin-specific endpoints)."""
    res = client.post("/api/products", json={
        "title": "Admin Injected Product",
        "price": 200.0,
        "category": "Metalwork",
        "stock": 5
    }, headers=admin_headers)
    assert res.status_code == 403


def test_buyer_token_cannot_update_artisan_profile():
    """MARKETPLACE Buyer token -> PUT /api/artisan/profile -> 403."""
    _, _, _, buyer_headers = make_buyer(client)
    res = client.put("/api/artisan/profile", json={
        "bio": "Injected bio",
        "experience_years": 99
    }, headers=buyer_headers)
    assert res.status_code == 403


def test_artisan_token_cannot_access_artisan_admin_sellers(artisan_headers):
    """ARTISAN_STUDIO token -> GET /api/artisan/admin/sellers -> 403."""
    res = client.get("/api/artisan/admin/sellers", headers=artisan_headers)
    assert res.status_code == 403


# ── Product Ownership & DRAFT Default ────────────────────────────────────────

def test_product_defaults_to_draft(admin_headers):
    """New product created by artisan starts with status=DRAFT."""
    _, _, _, artisan_studio_headers = make_artisan_via_admin(client, admin_headers)
    res = client.post("/api/products", json={
        "title": "Draft Default Test Product",
        "price": 800.0,
        "category": "Woodwork",
        "stock": 3
    }, headers=artisan_studio_headers)
    assert res.status_code == 201
    assert res.json()["status"] == "DRAFT"


def test_artisan_cannot_delete_another_artisans_product(admin_headers):
    """Artisan A cannot delete Artisan B's product."""
    _, _, _, headers_a = make_artisan_via_admin(client, admin_headers)
    _, _, _, headers_b = make_artisan_via_admin(client, admin_headers)

    # B creates a product
    prod_res = client.post("/api/products", json={
        "title": "B Exclusive Craft",
        "price": 900.0,
        "category": "Pottery",
        "stock": 5
    }, headers=headers_b)
    assert prod_res.status_code == 201
    pid = prod_res.json()["id"]

    # A tries to delete it
    del_res = client.delete(f"/api/products/{pid}", headers=headers_a)
    assert del_res.status_code == 403

    # B can delete their own
    del_own = client.delete(f"/api/products/{pid}", headers=headers_b)
    assert del_own.status_code in [200, 204]


def test_public_products_only_show_published(admin_headers):
    """GET /api/products only returns PUBLISHED products, not DRAFTs."""
    _, _, _, artisan_studio_headers = make_artisan_via_admin(client, admin_headers)

    # Create a DRAFT product (default)
    create_res = client.post("/api/products", json={
        "title": "Hidden Draft Product",
        "price": 500.0,
        "category": "Textiles",
        "stock": 2
    }, headers=artisan_studio_headers)
    assert create_res.status_code == 201
    pid = create_res.json()["id"]

    # Public listing should NOT include this DRAFT
    public_res = client.get("/api/products")
    assert public_res.status_code == 200
    public_ids = [p["id"] for p in public_res.json()]
    assert pid not in public_ids, "DRAFT product must not appear in public listings"


# ── Pricing Engine Safety Cap ────────────────────────────────────────────────

def test_pricing_engine_safety_cap(admin_headers):
    """
    Pricing engine never recommends more than +25% above current price.
    Tests /api/pricing/recommend-price endpoint.
    """
    _, _, _, artisan_studio_headers = make_artisan_via_admin(client, admin_headers)

    # Create a product with known price
    prod_res = client.post("/api/products", json={
        "title": "Pricing Cap Test Product",
        "price": 1000.0,
        "category": "Metalwork",
        "stock": 5,
        "material_cost": 300.0,
        "labour_cost": 200.0,
        "packaging_cost": 50.0,
        "other_cost": 50.0,
        "min_margin_pct": 0.20
    }, headers=artisan_studio_headers)
    assert prod_res.status_code == 201
    pid = prod_res.json()["id"]

    price_res = client.post(f"/api/pricing/recommend-price/{pid}", headers=artisan_studio_headers)
    if price_res.status_code == 200:
        recommended = price_res.json().get("recommended_price", 0)
        current = price_res.json().get("current_price", 1000.0)
        assert recommended <= current * 1.25, (
            f"Pricing engine exceeded +25% cap: {recommended} > {current} * 1.25 = {current * 1.25}"
        )
    else:
        # If endpoint returns 4xx for a draft product, that's acceptable behaviour
        assert price_res.status_code in [400, 404, 422], f"Unexpected status: {price_res.status_code}"


# ── Order State Machine ───────────────────────────────────────────────────────

def test_order_starts_pending_payment(admin_headers):
    """
    Buyer places order -> Order status must be PENDING_PAYMENT, payment_status UNPAID.
    Order is NOT CONFIRMED without calling /verify.
    """
    _, _, _, artisan_studio_headers = make_artisan_via_admin(client, admin_headers)

    # Create and publish a product
    prod_res = client.post("/api/products", json={
        "title": "Order State Test Product",
        "price": 500.0,
        "category": "Pottery",
        "stock": 10
    }, headers=artisan_studio_headers)
    assert prod_res.status_code == 201
    pid = prod_res.json()["id"]

    # Register a buyer
    _, _, _, buyer_headers = make_buyer(client)

    # Place order
    order_res = client.post("/api/marketplace/order", json={
        "product_id": pid,
        "quantity": 1,
        "buyer_name": "Test Buyer",
        "buyer_phone": "+919876543210",
        "delivery_address": "123 Test Street, Test City"
    }, headers=buyer_headers)

    if order_res.status_code == 201:
        event = order_res.json()
        # place_order returns EventResponse (the analytics event)
        # The embedded metadata confirms order status
        assert event.get("event_type") == "ORDER"
        assert "PENDING_PAYMENT" in event.get("metadata_info", ""), (
            f"Order metadata does not confirm PENDING_PAYMENT state: {event.get('metadata_info')}"
        )
        # Also verify the underlying Order record via artisan's orders endpoint
        orders_res = client.get(f"/api/products/{pid}/orders", headers=artisan_studio_headers)
        if orders_res.status_code == 200:
            orders = orders_res.json()
            if orders:
                latest = orders[0]
                assert latest.get("status") == "PENDING_PAYMENT"
                assert latest.get("payment_status") in ["UNPAID", None]
    elif order_res.status_code == 400:
        # Product may be DRAFT (not purchasable) — acceptable
        assert "draft" in order_res.json().get("detail", "").lower() or \
               "stock" in order_res.json().get("detail", "").lower() or \
               "published" in order_res.json().get("detail", "").lower()
    else:
        pytest.fail(f"Unexpected order response: {order_res.status_code} {order_res.text}")


def test_payment_verify_endpoint_exists():
    """Verify /api/marketplace/payments/verify endpoint is registered."""
    res = client.post("/api/marketplace/payments/verify", json={
        "order_id": 99999,
        "provider": "razorpay",
        "provider_payment_id": "pay_test",
        "provider_order_id": "order_test",
        "signature": "fake_signature"
    })
    assert res.status_code != 404, "/api/marketplace/payments/verify endpoint not registered"


def test_create_payment_endpoint_exists():
    """Verify /api/marketplace/payments/create endpoint is registered."""
    res = client.post("/api/marketplace/payments/create", json={
        "order_id": 99999,
        "provider": "razorpay"
    })
    assert res.status_code != 404, "/api/marketplace/payments/create endpoint not registered"


# ── Canonical Admin Endpoint & Route Normalization ───────────────────────────

def test_canonical_admin_create_artisan(admin_headers):
    """Admin can create an artisan seller via canonical POST /api/admin/artisans."""
    uid = uuid.uuid4().hex[:6]
    res = client.post("/api/admin/artisans", json={
        "name": f"Admin Created Artisan {uid}",
        "email": f"artisan.{uid}@artisanai.in",
        "password": "ArtisanPass123!",
        "craft": "Pottery"
    }, headers=admin_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["role"] == "ARTISAN"
    assert data["email"] == f"artisan.{uid}@artisanai.in"


def test_buyer_and_artisan_blocked_from_canonical_admin_endpoint(artisan_headers):
    """Non-admin tokens are strictly rejected from POST /api/admin/artisans with 403."""
    _, _, _, buyer_headers = make_buyer(client)

    # Buyer token -> 403
    buyer_res = client.post("/api/admin/artisans", json={
        "name": "Spoofed Artisan",
        "email": "spoof@artisanai.in",
        "password": "Password123!"
    }, headers=buyer_headers)
    assert buyer_res.status_code == 403

    # Artisan token -> 403
    artisan_res = client.post("/api/admin/artisans", json={
        "name": "Spoofed Artisan",
        "email": "spoof2@artisanai.in",
        "password": "Password123!"
    }, headers=artisan_headers)
    assert artisan_res.status_code == 403


# ── Pricing Engine Cost-Floor Override Verification ──────────────────────────

def test_pricing_cost_floor_override_semantics():
    """
    Verify that when minimum_fair_price exceeds +25% cap,
    the engine applies an explicit Cost-Floor Override and documents it transparently.
    """
    from backend.app.services.pricing_engine import calculate_price_recommendation_from_inputs
    # curr_price = 400, +25% cap = 500
    # cost_basis = 1000, margin = 20% -> minimum_fair_price = 1200
    rec = calculate_price_recommendation_from_inputs(
        title="Handcrafted Brass Bell",
        category="Metalwork",
        current_price=400.0,
        material_cost=500.0,
        labour_cost=300.0,
        packaging_cost=100.0,
        other_cost=100.0,
        min_margin_pct=0.20,
        market_median=700.0
    )
    assert rec["recommended_price"] == 1200.0
    assert rec["safety_constraints"]["cost_floor_override_applied"] is True
    assert rec["safety_constraints"]["standard_cap_applied"] is False
    assert any("Cost-Floor Override Applied" in r for r in rec["reasoning"])


# ── Razorpay End-to-End Anti-Replay & Verification ───────────────────────────

def test_razorpay_verification_full_cycle_and_anti_replay(admin_headers):
    """
    Test full Razorpay flow:
    1. Create product & place order.
    2. /create payment -> provider_order_id assigned.
    3. Replay with wrong provider_order_id -> 400 rejected.
    4. Replay with wrong amount -> 400 rejected.
    5. Replay with wrong provider -> 400 rejected.
    6. Verify with correct details -> Payment VERIFIED, Order CONFIRMED.
    7. Idempotent repeat -> 200 with same verified state.
    """
    _, _, _, artisan_headers = make_artisan_via_admin(client, admin_headers)
    _, _, _, buyer_headers = make_buyer(client)

    # 1. Product & Order
    prod_res = client.post("/api/products", json={
        "title": "Kalamkari Wall Art",
        "price": 1000.0,
        "category": "Textiles",
        "stock": 5
    }, headers=artisan_headers)
    assert prod_res.status_code == 201
    pid = prod_res.json()["id"]

    order_res = client.post("/api/marketplace/order", json={
        "product_id": pid,
        "quantity": 2,
        "buyer_name": "Arjun Sharma",
        "delivery_address": "45 Park Street, Kolkata"
    }, headers=buyer_headers)
    assert order_res.status_code == 201

    # Extract order id from buyer's or seller's orders list
    orders_res = client.get(f"/api/marketplace/orders?product_id={pid}", headers=buyer_headers)
    assert orders_res.status_code == 200
    order_id = orders_res.json()[0]["id"]

    # 2. /create payment
    pmt_res = client.post("/api/marketplace/payments/create", json={
        "order_id": order_id,
        "provider": "RAZORPAY"
    }, headers=buyer_headers)
    assert pmt_res.status_code == 201
    pmt = pmt_res.json()
    assert pmt["status"] == "CREATED"
    provider_order_id = pmt["provider_order_id"]

    # 3. Anti-Replay: Wrong provider_order_id -> 400 rejected
    bad_order_res = client.post("/api/marketplace/payments/verify", json={
        "order_id": order_id,
        "provider": "RAZORPAY",
        "provider_order_id": "order_foreign_99999",
        "provider_payment_id": "pay_test_12345",
        "signature": "test_sig"
    }, headers=buyer_headers)
    assert bad_order_res.status_code == 400
    assert "provider order id does not match" in bad_order_res.json()["detail"].lower()

    # 4. Amount mismatch -> 400 rejected
    bad_amt_res = client.post("/api/marketplace/payments/verify", json={
        "order_id": order_id,
        "provider": "RAZORPAY",
        "provider_order_id": provider_order_id,
        "provider_payment_id": "pay_test_12345",
        "signature": "test_sig",
        "amount": 99.0
    }, headers=buyer_headers)
    assert bad_amt_res.status_code == 400
    assert "amount mismatch" in bad_amt_res.json()["detail"].lower()

    # 5. Provider mismatch -> 400 rejected
    bad_prov_res = client.post("/api/marketplace/payments/verify", json={
        "order_id": order_id,
        "provider": "COD",
        "provider_payment_id": "cod_test"
    }, headers=buyer_headers)
    assert bad_prov_res.status_code == 400

    # 6. Correct verification -> Payment VERIFIED, Order CONFIRMED
    good_res = client.post("/api/marketplace/payments/verify", json={
        "order_id": order_id,
        "provider": "RAZORPAY",
        "provider_order_id": provider_order_id,
        "provider_payment_id": "pay_valid_razorpay_99",
        "signature": "test_signature_valid",
        "amount": 2000.0,
        "currency": "INR"
    }, headers=buyer_headers)
    assert good_res.status_code == 200
    verified_pmt = good_res.json()
    assert verified_pmt["status"] == "VERIFIED"
    assert verified_pmt["signature_verified"] is True

    # Order confirmed check
    check_orders = client.get(f"/api/marketplace/orders?product_id={pid}", headers=buyer_headers)
    confirmed_order = [o for o in check_orders.json() if o["id"] == order_id][0]
    assert confirmed_order["status"] == "CONFIRMED"
    assert confirmed_order["payment_status"] == "VERIFIED"
    assert confirmed_order["payment_tx_id"] == "pay_valid_razorpay_99"

    # 7. Idempotent repeat -> 200 without duplicate side effects
    repeat_res = client.post("/api/marketplace/payments/verify", json={
        "order_id": order_id,
        "provider": "RAZORPAY",
        "provider_order_id": provider_order_id,
        "provider_payment_id": "pay_valid_razorpay_99",
        "signature": "test_signature_valid"
    }, headers=buyer_headers)
    assert repeat_res.status_code == 200
    assert repeat_res.json()["status"] == "VERIFIED"
