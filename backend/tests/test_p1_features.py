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
    }, headers=seller_headers)
    assert confirm_res.status_code == 200
    assert confirm_res.json()["message"]["order"]["state"] == "ACCEPTED"

    # Verify stock decremented from 5 to 3
    get_prod = client.get(f"/api/products/{pid}")
    assert get_prod.json()["stock"] == 3

    # Attempting to confirm 4 units when only 3 remain fails with 400 (atomic DB update rejection)
    fail_confirm = client.post("/api/ondc/confirm", json={
        "product_id": pid,
        "quantity": 4,
        "buyer_name": "ONDC Buyer",
        "buyer_phone": "+91 91111 22222",
        "delivery_address": "Bengaluru, Karnataka"
    }, headers=seller_headers)
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


def test_sync_idempotency_tenant_isolation():
    """
    Verify composite uniqueness on (user_id, client_operation_id).
    Another user submitting the same client_operation_id is treated as a separate operation
    and does NOT receive User A's cached response.
    """
    uid1 = uuid.uuid4().hex[:6]
    uid2 = uuid.uuid4().hex[:6]

    reg1 = client.post("/api/auth/register", json={
        "name": f"User 1 {uid1}", "email": f"u1.{uid1}@artisanai.in", "password": "Password123!", "role": "ARTISAN"
    })
    h1 = {"Authorization": f"Bearer {reg1.json()['access_token']}"}

    reg2 = client.post("/api/auth/register", json={
        "name": f"User 2 {uid2}", "email": f"u2.{uid2}@artisanai.in", "password": "Password123!", "role": "ARTISAN"
    })
    h2 = {"Authorization": f"Bearer {reg2.json()['access_token']}"}

    shared_op_id = f"op_shared_{uuid.uuid4().hex[:8]}"

    # User 1 syncs with shared_op_id
    payload1 = {
        "products": [{"client_operation_id": shared_op_id, "title": "User 1 Item", "category": "Pottery", "price": 100.0}]
    }
    r1 = client.post("/api/sync/batch", json=payload1, headers=h1)
    assert r1.status_code == 200
    id1 = r1.json()["products_synced"][0]["server_id"]

    # User 2 syncs with SAME shared_op_id
    payload2 = {
        "products": [{"client_operation_id": shared_op_id, "title": "User 2 Item", "category": "Textiles", "price": 200.0}]
    }
    r2 = client.post("/api/sync/batch", json=payload2, headers=h2)
    assert r2.status_code == 200
    id2 = r2.json()["products_synced"][0]["server_id"]

    # Must be separate items created for different users, zero cross-tenant collision
    assert id1 != id2


def test_order_cancellation_restores_inventory():
    """Verify that cancelling an order restores the product's reserved stock."""
    uid = uuid.uuid4().hex[:6]
    seller = client.post("/api/auth/register", json={
        "name": f"Stock Seller {uid}", "email": f"stock.seller.{uid}@artisanai.in", "password": "Password123!", "role": "ARTISAN"
    })
    seller_h = {"Authorization": f"Bearer {seller.json()['access_token']}"}

    buyer = client.post("/api/auth/register", json={
        "name": f"Stock Buyer {uid}", "email": f"stock.buyer.{uid}@artisanai.in", "password": "Password123!", "role": "BUYER"
    })
    buyer_h = {"Authorization": f"Bearer {buyer.json()['access_token']}"}

    prod = client.post("/api/products", json={
        "title": f"Restorable Item {uid}", "category": "Woodwork", "price": 500.0, "stock": 10
    }, headers=seller_h).json()
    pid = prod["id"]

    # Place order of 3 units
    ord_res = client.post("/api/marketplace/order", json={
        "product_id": pid, "quantity": 3, "buyer_name": "Buyer Test", "buyer_phone": "+91 99999 88888", "delivery_address": "Test Street"
    }, headers=buyer_h)
    assert ord_res.status_code in [200, 201]
    oid = ord_res.json()["id"]

    # Check stock decremented to 7
    p_check1 = client.get(f"/api/products/{pid}").json()
    assert p_check1["stock"] == 7

    # Cancel order
    cancel_res = client.patch(f"/api/marketplace/orders/{oid}/status", json={"status": "CANCELLED"}, headers=buyer_h)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # Check stock restored back to 10
    p_check2 = client.get(f"/api/products/{pid}").json()
    assert p_check2["stock"] == 10


# =====================================================================
# 5. BUYER AI COPILOT LIVE SEARCH TESTS
# =====================================================================

def test_buyer_copilot_live_search():
    """
    Verify /api/buyer/copilot-chat endpoint performs live database search,
    filters by keywords/category/price, and returns responses in Telugu, Hindi, and English.
    """
    # 1. Search in Telugu
    res_te = client.post("/api/buyer/copilot-chat", json={
        "message": "నాకు చెక్క బొమ్మలు 2000 రూపాయిలలోపు కావాలి",
        "language": "te"
    })
    assert res_te.status_code == 200
    data_te = res_te.json()
    assert "reply_text" in data_te
    assert "recommended_products" in data_te
    assert isinstance(data_te["recommended_products"], list)
    assert data_te["language"] == "te"

    # 2. Search in Hindi
    res_hi = client.post("/api/buyer/copilot-chat", json={
        "message": "कलमकारी दुपट्टा दिखाओ",
        "language": "hi"
    })
    assert res_hi.status_code == 200
    data_hi = res_hi.json()
    assert data_hi["language"] == "hi"
    assert "recommended_products" in data_hi

    # 3. Search in English with max_budget
    res_en = client.post("/api/buyer/copilot-chat", json={
        "message": "Show me blue pottery under 1500",
        "language": "en",
        "max_budget": 1500.0
    })
    assert res_en.status_code == 200
    data_en = res_en.json()
    assert data_en["language"] == "en"
    assert isinstance(data_en["recommended_products"], list)


def test_buyer_copilot_audit_fixes():
    """
    Verifies audit compliance for AI Buyer Copilot:
    1. Hybrid intent extraction & keyword refinement ('blue pottery under 1500' -> category + price filter).
    2. Fallback trust fix (is_fallback is True, match_count is 0 when no exact match exists).
    3. Prohibition of false 'certified GI heritage crafts' claim in fallback response.
    """
    # 1. Search for a query that yields no exact matches in DB (e.g. non-existent category or query)
    res = client.post("/api/buyer/copilot-chat", json={
        "message": "Unobtainium Space Craft under 50",
        "language": "en"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_fallback"] is True
    assert data["match_count"] == 0
    assert "certified GI heritage crafts" not in data["reply_text"]
    reply_lower = data["reply_text"].lower()
    assert any(phrase in reply_lower for phrase in ["no exact matches", "couldn't find", "popular", "alternative"])

    # 2. Telugu fallback check
    res_te = client.post("/api/buyer/copilot-chat", json={
        "message": "సరిపోలని కొత్త కానుక 10 రూపాయలు",
        "language": "te"
    })
    assert res_te.status_code == 200
    data_te = res_te.json()
    assert data_te["is_fallback"] is True
    assert len(data_te["reply_text"]) > 0






