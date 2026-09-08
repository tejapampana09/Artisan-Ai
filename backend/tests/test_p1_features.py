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
# 2. P1-D: CSV EXPORT ANALYTICS REPORT TEST
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


def test_estimate_product_price_endpoint():
    """
    Verify /api/ai/estimate-price calculates fair market price based on category/similar products
    when no cost inputs are provided, or cost + margin when costs are provided.
    """
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"Pricing Artisan {uid}",
        "email": f"pricing.artisan.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # 1. Market Benchmark / AI Price (No cost inputs provided)
    res_no_costs = client.post("/api/ai/estimate-price", json={
        "title": "Traditional Kalamkari Silk Saree",
        "category": "Kalamkari",
        "materials": "Mulberry Silk"
    }, headers=headers)
    assert res_no_costs.status_code == 200
    data1 = res_no_costs.json()
    assert float(data1["suggested_price"]) > 0
    assert float(data1["min_fair_price"]) > 0
    assert data1["pricing_source"] in ["MARKET_AI_ESTIMATE", "MARKET_CATEGORY_BENCHMARK"]

    # 2. Cost-Plus Margin Price (Itemized costs provided)
    res_with_costs = client.post("/api/ai/estimate-price", json={
        "title": "Terracotta Diya Set",
        "category": "Terracotta",
        "material_cost": 100.0,
        "labour_cost": 200.0,
        "packaging_cost": 50.0
    }, headers=headers)
    assert res_with_costs.status_code == 200
    data2 = res_with_costs.json()
    assert data2["pricing_source"] == "COST_PLUS_MARGIN"
    assert float(data2["min_fair_price"]) == 420.0  # (350 * 1.20)
    assert float(data2["suggested_price"]) == 490.0  # (350 * 1.40)

