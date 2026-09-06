import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

# =====================================================================
# 1. P1-A: TOKEN VERSIONING & INSTANT SESSION REVOCATION TESTS
# =====================================================================

def test_password_change_revokes_old_jwt_token():
    """
    Verify that changing password increments user's token_version,
    immediately revoking access for pre-existing JWT access tokens.
    """
    uid = uuid.uuid4().hex[:6]
    email = f"ver.user.{uid}@artisanai.in"
    reg = client.post("/api/auth/register", json={
        "name": "Token Version User",
        "email": email,
        "password": "Password123!",
        "role": "ARTISAN"
    })
    assert reg.status_code == 201
    old_token = reg.json()["access_token"]
    old_headers = {"Authorization": f"Bearer {old_token}"}

    # Verify old token works before password change
    me_before = client.get("/api/auth/me", headers=old_headers)
    assert me_before.status_code == 200

    # Perform password change using old token
    change_res = client.post("/api/auth/change-password", json={
        "current_password": "Password123!",
        "new_password": "NewSecretPassword456!"
    }, headers=old_headers)
    assert change_res.status_code == 200
    new_token = change_res.json()["access_token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}

    # Verify old token is now REVOKED (returns 401 Unauthorized)
    me_after_old = client.get("/api/auth/me", headers=old_headers)
    assert me_after_old.status_code == 401
    assert "revoked" in me_after_old.json()["detail"].lower()

    # Verify new token works cleanly
    me_after_new = client.get("/api/auth/me", headers=new_headers)
    assert me_after_new.status_code == 200
    assert me_after_new.json()["email"] == email


# =====================================================================
# 2. P1-B: ONDC BECKN PROTOCOL GATEWAY TESTS
# =====================================================================

def test_ondc_beckn_gateway_flow():
    """
    Verify full Beckn protocol lifecycle: /search -> /select -> /init -> /confirm.
    Ensures stock is decremented atomically and order is created.
    """
    uid = uuid.uuid4().hex[:6]

    # Create artisan & product
    reg = client.post("/api/auth/register", json={
        "name": f"ONDC Seller {uid}",
        "email": f"ondc.seller.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    seller_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    prod_res = client.post("/api/products", json={
        "title": f"Bidriware Plate {uid}",
        "category": "Bidriware",
        "price": 2500.0,
        "stock": 5
    }, headers=seller_headers)
    assert prod_res.status_code == 201
    pid = prod_res.json()["id"]

    # 1. ONDC /search
    search_res = client.post("/api/ondc/search", json={
        "intent": {"category": "Bidriware"}
    })
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert "context" in search_data
    items = search_data["message"]["catalog"]["bpp/providers"][0]["items"]
    target_item = next(item for item in items if item["id"] == str(pid))
    assert "ondc_certified" not in target_item  # Guarantee zero overclaiming

    # 2. ONDC /select (Quote)
    select_res = client.post("/api/ondc/select", json={
        "product_id": pid,
        "quantity": 2
    })
    assert select_res.status_code == 200
    quote_val = float(select_res.json()["message"]["order"]["quote"]["price"]["value"])
    assert quote_val == 5050.0  # (2500 * 2) + 50 estimated delivery

    # 3. ONDC /init
    init_res = client.post("/api/ondc/init", json={
        "product_id": pid,
        "quantity": 2,
        "buyer_name": "ONDC Buyer",
        "buyer_phone": "+91 91111 22222",
        "delivery_address": "Bengaluru, Karnataka"
    })
    assert init_res.status_code == 200

    # 4. ONDC /confirm (Order creation & atomic stock decrement)
    confirm_res = client.post("/api/ondc/confirm", json={
        "product_id": pid,
        "quantity": 2,
        "buyer_name": "ONDC Buyer",
        "buyer_phone": "+91 91111 22222",
        "delivery_address": "Bengaluru, Karnataka"
    })
    assert confirm_res.status_code == 200
    assert confirm_res.json()["message"]["order"]["state"] == "ACCEPTED"

    # Verify stock decremented from 5 to 3
    get_prod = client.get(f"/api/products/{pid}")
    assert get_prod.json()["stock"] == 3

    # Attempting to confirm 4 units when only 3 remain fails with 400 (atomic DB update rejection)
    fail_confirm = client.post("/api/ondc/confirm", json={
        "product_id": pid,
        "quantity": 4,
        "buyer_name": "ONDC Buyer 2",
        "buyer_phone": "+91 91111 33333",
        "delivery_address": "Chennai, Tamil Nadu"
    })
    assert fail_confirm.status_code == 400
    assert "stock unavailable" in fail_confirm.json()["detail"].lower()


# =====================================================================
# 3. P1-D: CSV EXPORT ANALYTICS REPORT TEST
# =====================================================================

def test_seller_analytics_csv_export():
    """Verify CSV export endpoint returns text/csv with seller product headers."""
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"CSV Seller {uid}",
        "email": f"csv.seller.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    client.post("/api/products", json={
        "title": f"Channapatna Craft {uid}",
        "category": "Wooden Toys",
        "price": 450.0,
        "stock": 15
    }, headers=headers)

    export_res = client.get("/api/seller/analytics/export", headers=headers)
    assert export_res.status_code == 200
    assert export_res.headers["content-type"].startswith("text/csv")
    csv_text = export_res.text
    assert "Product ID" in csv_text
    assert "Listing Price (INR)" in csv_text
    assert f"Channapatna Craft {uid}" in csv_text


# =====================================================================
# 4. P1-A & OBSERVABILITY: RATE LIMITING & REQUEST HEADERS
# =====================================================================

def test_request_observability_headers():
    """Verify X-Request-ID and X-Process-Time-Ms headers are injected."""
    res = client.get("/api/health")
    assert res.status_code == 200
    assert "x-request-id" in res.headers
    assert "x-process-time-ms" in res.headers

def test_auth_rate_limiting_enforced():
    """Verify that sliding window rate limiter triggers HTTP 429 Too Many Requests."""
    from backend.app.services.rate_limiter import rate_limiter
    from fastapi import HTTPException

    key = f"test_rate_limit:ip:127.0.0.1_{uuid.uuid4().hex[:4]}"

    # First 5 calls allowed
    for _ in range(5):
        rate_limiter.check_rate_limit(key, max_requests=5, window_seconds=60)

    # 6th call raises HTTP 429
    with pytest.raises(HTTPException) as exc_info:
        rate_limiter.check_rate_limit(key, max_requests=5, window_seconds=60)

    assert exc_info.value.status_code == 429
    assert "rate limit exceeded" in exc_info.value.detail.lower()
    headers_lower = {k.lower(): v for k, v in exc_info.value.headers.items()}
    assert "retry-after" in headers_lower


# =====================================================================
# 5. P1-C: PERSISTENT SYNC IDEMPOTENCY TEST
# =====================================================================

def test_sync_idempotency_client_operation_id():
    """
    Verify that repeating a sync payload with the same client_operation_id
    returns the stored result without creating duplicate products or records in DB.
    """
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"Idem Seller {uid}",
        "email": f"idem.seller.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    op_id = f"op_sync_{uuid.uuid4().hex[:8]}"

    sync_payload = {
        "products": [
            {
                "client_temp_id": "temp_1",
                "client_operation_id": op_id,
                "title": f"Idempotent Terracotta Pot {uid}",
                "category": "Pottery",
                "price": 350.0,
                "stock": 10
            }
        ]
    }

    # First sync call
    res1 = client.post("/api/sync/batch", json=sync_payload, headers=headers)
    assert res1.status_code == 200
    res1_data = res1.json()
    assert len(res1_data["products_synced"]) == 1
    server_id_1 = res1_data["products_synced"][0]["server_id"]

    # Second sync call with exact same client_operation_id (network retry simulation)
    res2 = client.post("/api/sync/batch", json=sync_payload, headers=headers)
    assert res2.status_code == 200
    res2_data = res2.json()
    assert len(res2_data["products_synced"]) == 1
    server_id_2 = res2_data["products_synced"][0]["server_id"]

    # Guaranteed idempotency: returns the EXACT SAME server product ID, no duplicate row created
    assert server_id_1 == server_id_2

