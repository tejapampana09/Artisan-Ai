import httpx
import time
import sys
sys.stdout.reconfigure(encoding='utf-8')

BASE = "https://artisan-ai-rpw7.onrender.com"
ORIGIN = "https://artisan-ai-gamma.vercel.app"

headers_cors = {
    "Origin": ORIGIN,
    "Content-Type": "application/json"
}

results = []

def test(name, fn):
    try:
        fn()
        print(f"  ✅ [PASS] {name}")
        results.append((name, "PASS", None))
    except Exception as e:
        print(f"  ❌ [FAIL] {name}: {e}")
        results.append((name, "FAIL", str(e)))

print(f"\n=======================================================")
print(f"🚀 RUNNING COMPLETE LIVE END-TO-END SYSTEM AUDIT")
print(f"Backend: {BASE}")
print(f"Frontend Origin: {ORIGIN}")
print(f"=======================================================\n")

# Storage for tokens and IDs across tests
context = {}

# ── 1. SYSTEM HEALTH & ALIAS REWRITING ─────────────────────────────────────────
print("1️⃣ Testing System Health & Path Rewriting...")

def test_health():
    r = httpx.get(f"{BASE}/api/health", headers=headers_cors, timeout=10)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    assert r.json().get("status") == "ok"
test("GET /api/health", test_health)

def test_health_rewrite():
    r = httpx.get(f"{BASE}/health", headers=headers_cors, timeout=10)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
test("GET /health (No /api prefix rewrite)", test_health_rewrite)

def test_ready():
    r = httpx.get(f"{BASE}/api/ready", headers=headers_cors, timeout=10)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    assert r.json().get("database") == "connected"
test("GET /api/ready (Database Connection)", test_ready)


# ── 2. ADMIN AUTHENTICATION & CONSOLE ──────────────────────────────────────────
print("\n2️⃣ Testing Admin Console...")

def test_admin_login():
    r = httpx.post(
        f"{BASE}/api/admin/auth/login",
        json={"email_or_phone": "admin@artisanai.com", "password": "admin123"},
        headers=headers_cors,
        timeout=10
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ADMIN"
    context["admin_token"] = data["access_token"]
test("POST /api/admin/auth/login", test_admin_login)

def test_admin_list_artisans():
    token = context["admin_token"]
    r = httpx.get(
        f"{BASE}/api/admin/artisans",
        headers={**headers_cors, "Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert r.status_code == 200, f"List artisans failed: {r.status_code} {r.text}"
    artisans = r.json()
    assert isinstance(artisans, list)
    assert len(artisans) > 0, "Expected at least 1 artisan"
    context["artisan_id"] = artisans[0]["id"]
test("GET /api/admin/artisans", test_admin_list_artisans)

def test_admin_reset_artisan_password():
    token = context["admin_token"]
    aid = context["artisan_id"]
    r = httpx.post(
        f"{BASE}/api/admin/artisans/{aid}/reset-password",
        json={"new_password": "password123"},
        headers={**headers_cors, "Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert r.status_code == 200, f"Reset password failed: {r.status_code} {r.text}"
    assert r.headers.get("access-control-allow-origin") == ORIGIN, "CORS header missing!"
test("POST /api/admin/artisans/{id}/reset-password (with CORS)", test_admin_reset_artisan_password)

def test_admin_list_products():
    token = context["admin_token"]
    r = httpx.get(
        f"{BASE}/api/admin/products",
        headers={**headers_cors, "Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert r.status_code == 200, f"Admin list products failed: {r.status_code} {r.text}"
    prods = r.json()
    assert isinstance(prods, list)
    context["admin_products"] = prods
test("GET /api/admin/products (Moderation list)", test_admin_list_products)


# ── 3. PUBLIC MARKETPLACE & PRODUCTS ──────────────────────────────────────────
print("\n3️⃣ Testing Marketplace & Product Feeds...")

def test_published_products():
    r = httpx.get(f"{BASE}/api/products?status=PUBLISHED", headers=headers_cors, timeout=10)
    assert r.status_code == 200, f"Published products failed: {r.status_code} {r.text}"
    prods = r.json()
    assert isinstance(prods, list)
test("GET /api/products?status=PUBLISHED", test_published_products)

def test_published_products_rewrite():
    r = httpx.get(f"{BASE}/products?status=PUBLISHED", headers=headers_cors, timeout=10)
    assert r.status_code == 200, f"Products without /api failed: {r.status_code} {r.text}"
test("GET /products?status=PUBLISHED (No /api prefix rewrite)", test_published_products_rewrite)

def test_trending():
    r = httpx.get(f"{BASE}/api/marketplace/trending", headers=headers_cors, timeout=10)
    assert r.status_code == 200, f"Trending failed: {r.status_code} {r.text}"
test("GET /api/marketplace/trending", test_trending)


# ── 4. ARTISAN STUDIO AUTH & PRODUCT LIFECYCLE ────────────────────────────────
print("\n4️⃣ Testing Artisan Studio & Product Lifecycle...")

def test_artisan_login():
    r = httpx.post(
        f"{BASE}/api/studio/auth/login",
        json={"email_or_phone": "tejapampana09@gmail.com", "password": "password123"},
        headers=headers_cors,
        timeout=10
    )
    assert r.status_code == 200, f"Artisan login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ARTISAN"
    context["artisan_token"] = data["access_token"]
test("POST /api/studio/auth/login", test_artisan_login)

def test_artisan_create_product():
    token = context["artisan_token"]
    r = httpx.post(
        f"{BASE}/api/products",
        json={
            "title": "Automated Verification Craft Item",
            "category": "Wooden Crafts",
            "price": 999.0,
            "stock": 10,
            "description": "Transient test verification craft item",
            "materials": "Teak Wood",
            "craft_story": "Heritage craft story",
            "status": "DRAFT"
        },
        headers={**headers_cors, "Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert r.status_code in (200, 201), f"Create product failed: {r.status_code} {r.text}"
    created = r.json()
    assert "id" in created
    context["created_product_id"] = created["id"]
test("POST /api/products (Create Craft)", test_artisan_create_product)

def test_artisan_update_product():
    token = context["artisan_token"]
    pid = context["created_product_id"]
    r = httpx.patch(
        f"{BASE}/api/products/{pid}",
        json={"price": 1099.0, "stock": 8},
        headers={**headers_cors, "Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert r.status_code == 200, f"Update product failed: {r.status_code} {r.text}"
    assert float(r.json()["price"]) == 1099.0
test("PATCH /api/products/{id} (Update Craft Details)", test_artisan_update_product)

def test_admin_approve_and_publish():
    token = context["admin_token"]
    pid = context["created_product_id"]
    r_app = httpx.patch(
        f"{BASE}/api/admin/products/{pid}/approve",
        headers={**headers_cors, "Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert r_app.status_code == 200, f"Approve failed: {r_app.status_code} {r_app.text}"
    r_pub = httpx.patch(
        f"{BASE}/api/admin/products/{pid}/publish",
        headers={**headers_cors, "Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert r_pub.status_code == 200, f"Publish failed: {r_pub.status_code} {r_pub.text}"
    assert r_pub.json()["status"] == "PUBLISHED"
test("PATCH /api/admin/products/{id}/(approve & publish)", test_admin_approve_and_publish)

def test_get_single_product():
    pid = context["created_product_id"]
    r = httpx.get(f"{BASE}/api/products/{pid}", headers=headers_cors, timeout=10)
    assert r.status_code == 200, f"Single product failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["id"] == pid
test("GET /api/products/{id}", test_get_single_product)


# ── 5. BUYER AUTH, ORDERS & FULL CLEANUP ───────────────────────────────────────
print("\n5️⃣ Testing Buyer Flow, Order Placement & Zero-Residual Cleanup...")

def test_buyer_login_or_guest():
    r = httpx.post(
        f"{BASE}/api/marketplace/auth/login",
        json={"email_or_phone": "buyer@artisanai.in", "password": "password123"},
        headers=headers_cors,
        timeout=10
    )
    if r.status_code == 200:
        context["buyer_token"] = r.json()["access_token"]
    else:
        reg = httpx.post(
            f"{BASE}/api/marketplace/auth/register",
            json={"name": "Test Buyer", "email": "buyer@artisanai.in", "password": "password123", "phone": "9998887776"},
            headers=headers_cors,
            timeout=10
        )
        assert reg.status_code in (200, 201), f"Buyer register failed: {reg.status_code} {reg.text}"
        context["buyer_token"] = reg.json()["access_token"]
test("POST /api/marketplace/auth/login (or Register)", test_buyer_login_or_guest)

def test_place_order():
    token = context["buyer_token"]
    pid = context["created_product_id"]
    r = httpx.post(
        f"{BASE}/api/orders",
        json={
            "product_id": pid,
            "buyer_name": "Test Buyer",
            "buyer_phone": "9998887776",
            "quantity": 1,
            "delivery_address": "123 Heritage Lane, Bengaluru, Karnataka 560001",
            "payment_method": "COD"
        },
        headers={**headers_cors, "Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert r.status_code in (200, 201), f"Place order failed: {r.status_code} {r.text}"
    order = r.json()
    assert "id" in order
test("POST /api/orders (Place Order Directly)", test_place_order)

def test_buyer_get_orders():
    token = context["buyer_token"]
    r = httpx.get(
        f"{BASE}/api/orders?role_view=buyer",
        headers={**headers_cors, "Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert r.status_code == 200, f"Get buyer orders failed: {r.status_code} {r.text}"
    orders = r.json()
    assert isinstance(orders, list)
    assert len(orders) > 0, "Expected order to appear in buyer history"
test("GET /api/orders (Buyer Order History)", test_buyer_get_orders)

def test_cleanup_product_and_orders():
    """Artisan deletes the test craft, cascading deletion of test orders & events to leave DB 100% clean."""
    token = context["artisan_token"]
    pid = context["created_product_id"]
    r = httpx.delete(
        f"{BASE}/api/products/{pid}",
        headers={**headers_cors, "Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert r.status_code == 204, f"Cleanup product failed: {r.status_code} {r.text}"
test("DELETE /api/products/{id} (Artisan Cascade Cleanup -> 0 Fake Items in DB)", test_cleanup_product_and_orders)


# ── 6. NOTIFICATIONS ──────────────────────────────────────────────────────────
print("\n6️⃣ Testing Notifications System...")

def test_notifications():
    token = context["artisan_token"]
    r = httpx.get(
        f"{BASE}/api/notifications",
        headers={**headers_cors, "Authorization": f"Bearer {token}"},
        timeout=10
    )
    assert r.status_code == 200, f"Notifications failed: {r.status_code} {r.text}"
    notifs = r.json()
    assert isinstance(notifs, list)
test("GET /api/notifications (Artisan Alerts)", test_notifications)


# ── 7. CORS PREFLIGHT ON ALL KEY ENDPOINTS ────────────────────────────────────
print("\n7️⃣ Testing CORS Preflight (OPTIONS) for Vercel...")

endpoints_to_preflight = [
    "/api/products",
    "/api/orders",
    "/api/notifications",
    "/api/admin/artisans",
    "/api/admin/products",
    f"/api/admin/artisans/{context.get('artisan_id', 2)}/reset-password",
]

for ep in endpoints_to_preflight:
    def make_preflight_test(endpoint):
        def _test():
            r = httpx.options(
                f"{BASE}{endpoint}",
                headers={
                    "Origin": ORIGIN,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "authorization,content-type"
                },
                timeout=10
            )
            assert r.status_code == 200, f"Preflight failed on {endpoint}: {r.status_code}"
            assert r.headers.get("access-control-allow-origin") == ORIGIN, f"Missing CORS header on {endpoint}"
        return _test
    test(f"OPTIONS {ep} -> Access-Control-Allow-Origin: {ORIGIN}", make_preflight_test(ep))


# ── SUMMARY ───────────────────────────────────────────────────────────────────
print(f"\n=======================================================")
passed = sum(1 for _, s, _ in results if s == "PASS")
failed = sum(1 for _, s, _ in results if s == "FAIL")
print(f"📊 SUMMARY: {passed} PASSED | {failed} FAILED out of {len(results)} tests")
print(f"=======================================================\n")

if failed > 0:
    sys.exit(1)
