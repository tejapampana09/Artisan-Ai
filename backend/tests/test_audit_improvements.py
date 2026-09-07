import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_auth_registration_and_login_flow():
    uid = uuid.uuid4().hex[:6]
    email = f"ravi.varma.{uid}@artisanai.in"
    phone = f"+91 94444 {uid[:5]}"
    
    # 1. Register a new artisan user
    reg_payload = {
        "name": "Ravi Varma",
        "email": email,
        "phone": phone,
        "password": "SecurePassword123!",
        "role": "ARTISAN",
        "location": "Thanjavur, Tamil Nadu",
        "craft": "Tanjore Gold Leaf Painting",
        "active_mode": "SELL"
    }
    reg_res = client.post("/api/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["token_type"] == "bearer"
    assert reg_data["user"]["name"] == "Ravi Varma"
    assert reg_data["user"]["email"] == email

    # 2. Reject duplicate registration
    dup_res = client.post("/api/auth/register", json=reg_payload)
    assert dup_res.status_code == 400
    assert "already registered" in dup_res.json()["detail"].lower()

    # 3. Test Login with email and password
    login_payload = {
        "email_or_phone": email,
        "password": "SecurePassword123!"
    }
    login_res = client.post("/api/auth/login", json=login_payload)
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    assert token is not None

    # 4. Reject invalid password
    bad_login = client.post("/api/auth/login", json={
        "email_or_phone": email,
        "password": "WrongPassword999"
    })
    assert bad_login.status_code == 401

    # 5. Access authenticated endpoint /api/auth/me with Bearer token
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email

    # 6. Reject invalid token
    invalid_res = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid_garbage_token"})
    assert invalid_res.status_code == 401

def test_reset_password_flow():
    uid = uuid.uuid4().hex[:6]
    email = f"artisan.{uid}@artisanai.in"
    phone = f"+91 93333 {uid[:5]}"

    # 1. Register user
    reg = client.post("/api/auth/register", json={
        "name": "Artisan Reset Test",
        "email": email,
        "phone": phone,
        "password": "OldPassword123!",
        "role": "ARTISAN"
    })
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Public reset-password endpoint returns 501 Not Implemented
    reset_res = client.post("/api/auth/reset-password", json={
        "email_or_phone": email,
        "new_password": "NewSecretPassword456!"
    })
    assert reset_res.status_code == 501

    # 3. Authenticated change-password with correct current password succeeds
    change_res = client.post("/api/auth/change-password", json={
        "current_password": "OldPassword123!",
        "new_password": "NewSecretPassword456!"
    }, headers=headers)
    assert change_res.status_code == 200
    assert "access_token" in change_res.json()

    # 4. Verify login works with new password
    new_login = client.post("/api/auth/login", json={
        "email_or_phone": email,
        "password": "NewSecretPassword456!"
    })
    assert new_login.status_code == 200

    # 5. Verify old password is now rejected
    old_login = client.post("/api/auth/login", json={
        "email_or_phone": email,
        "password": "OldPassword123!"
    })
    assert old_login.status_code == 401


def test_product_ownership_and_seller_isolation():
    uid = uuid.uuid4().hex[:6]
    # Setup User 1 (Demo user token or default)
    user1_res = client.get("/api/me")
    assert user1_res.status_code == 200
    user1_id = user1_res.json()["id"]

    # Register User 2 (Ramesh Artisan)
    user2_reg = client.post("/api/auth/register", json={
        "name": "Ramesh Bastar",
        "email": f"ramesh.dokra.{uid}@artisanai.in",
        "phone": f"+91 97777 {uid[:5]}",
        "password": "RameshPassword123!",
        "role": "ARTISAN",
        "craft": "Bastar Dokra"
    })
    assert user2_reg.status_code == 201
    user2_token = user2_reg.json()["access_token"]
    user2_headers = {"Authorization": f"Bearer {user2_token}"}
    user2_id = user2_reg.json()["user"]["id"]
    assert user1_id != user2_id

    # User 1 creates Product 1
    prod1_res = client.post("/api/products", json={
        "title": "User 1 Protected Kalamkari Artwork",
        "category": "Kalamkari",
        "price": 2500.0,
        "stock": 5,
        "material_cost": 600.0,
        "labour_cost": 800.0,
        "packaging_cost": 100.0,
        "seller_id": user1_id
    })
    assert prod1_res.status_code == 201
    prod1_id = prod1_res.json()["id"]

    # User 2 attempts to UPDATE User 1's product -> MUST BE 403 FORBIDDEN
    hack_update = client.patch(
        f"/api/products/{prod1_id}",
        json={"price": 10.0, "title": "Hacked Title"},
        headers=user2_headers
    )
    assert hack_update.status_code == 403
    assert "permission" in hack_update.json()["detail"].lower()

    # User 2 attempts to DELETE User 1's product -> MUST BE 403 FORBIDDEN
    hack_delete = client.delete(
        f"/api/products/{prod1_id}",
        headers=user2_headers
    )
    assert hack_delete.status_code == 403
    assert "permission" in hack_delete.json()["detail"].lower()

    # User 2 attempts to make a PRICING DECISION on User 1's product -> MUST BE 403 FORBIDDEN
    hack_pricing = client.post(
        f"/api/products/{prod1_id}/price-decision",
        json={"decision": "ACCEPT"},
        headers=user2_headers
    )
    assert hack_pricing.status_code == 403
    assert "permission" in hack_pricing.json()["detail"].lower()

    # User 2 creates their OWN product
    user2_prod = client.post(
        "/api/products",
        json={
            "title": "Ramesh Bastar Dokra Horse",
            "category": "Dokra",
            "price": 1800.0,
            "stock": 3,
            "material_cost": 400.0,
            "labour_cost": 600.0,
            "packaging_cost": 80.0
        },
        headers=user2_headers
    )
    assert user2_prod.status_code == 201
    user2_prod_id = user2_prod.json()["id"]

    # User 2 CAN update their own product
    valid_update = client.patch(
        f"/api/products/{user2_prod_id}",
        json={"price": 1950.0},
        headers=user2_headers
    )
    assert valid_update.status_code == 200
    assert valid_update.json()["price"] == 1950.0

def test_order_inventory_concurrency_and_data_privacy():
    # 1. Create a product with known stock = 3
    prod_res = client.post("/api/products", json={
        "title": "Privacy and Concurrency Test Saree",
        "category": "Kalamkari",
        "price": 1500.0,
        "stock": 3,
        "material_cost": 400.0,
        "labour_cost": 400.0,
        "packaging_cost": 50.0
    })
    assert prod_res.status_code == 201
    prod = prod_res.json()
    pid = prod["id"]

    # 2. Place valid order for quantity 2
    order_res = client.post("/api/marketplace/order", json={
        "product_id": pid,
        "buyer_name": "Priya Sundaram",
        "buyer_phone": "+91 99888 77777",
        "quantity": 2,
        "delivery_address": "Apartment 402, Heritage Enclave, Chennai 600028"
    })
    assert order_res.status_code == 201
    evt = order_res.json()

    # 3. Privacy Rule: Check that event metadata DOES NOT contain buyer phone or delivery address
    assert "+91 99888 77777" not in evt["metadata_info"]
    assert "Heritage Enclave" not in evt["metadata_info"]
    assert "Indiranagar" not in evt["metadata_info"]

    # 4. Check that order is stored in dedicated structured orders table
    orders_res = client.get(f"/api/marketplace/orders?product_id={pid}")
    assert orders_res.status_code == 200
    orders_list = orders_res.json()
    assert len(orders_list) == 1
    stored_order = orders_list[0]
    assert stored_order["buyer_name"] == "Priya Sundaram"
    assert stored_order["quantity"] == 2
    assert stored_order["unit_price"] == 1500.0
    assert stored_order["total_price"] == 3000.0
    assert stored_order["delivery_address"] == "Apartment 402, Heritage Enclave, Chennai 600028"

    # 5. Verify inventory decremented from 3 -> 1
    check_prod = client.get(f"/api/products/{pid}").json()
    assert check_prod["stock"] == 1

    # 6. Concurrency / Insufficient stock protection: Attempt to order 2 units when only 1 is available
    bad_order_res = client.post("/api/marketplace/order", json={
        "product_id": pid,
        "buyer_name": "Over-requester",
        "quantity": 2,
        "delivery_address": "Nowhere"
    })
    assert bad_order_res.status_code == 400
    assert "Insufficient stock" in bad_order_res.json()["detail"]

    # Verify inventory was NOT decremented on failed order
    check_prod_after_fail = client.get(f"/api/products/{pid}").json()
    assert check_prod_after_fail["stock"] == 1

    # 7. Submit enquiry with buyer phone number
    enquiry_res = client.post("/api/marketplace/enquire", json={
        "product_id": pid,
        "buyer_name": "Kavita Rao",
        "buyer_phone": "+91 98450 12345",
        "quantity": 5,
        "message": "Can this be custom woven with peacock border?"
    })
    assert enquiry_res.status_code == 201
    enquiry_evt = enquiry_res.json()

    # Privacy Rule: Check that event metadata DOES NOT contain buyer phone number
    assert "+91 98450 12345" not in enquiry_evt["metadata_info"]

    # Check structured enquiry table contains the lead
    enquiries_res = client.get(f"/api/marketplace/enquiries?product_id={pid}")
    assert enquiries_res.status_code == 200
    enquiries_list = enquiries_res.json()
    assert len(enquiries_list) >= 1
    assert enquiries_list[0]["buyer_name"] == "Kavita Rao"

def test_production_security_and_strict_demo_isolation(monkeypatch):
    from backend.app.services.auth import get_current_user, get_current_user_strict
    from backend.app.database import SessionLocal
    from fastapi import HTTPException

    db = SessionLocal()
    try:
        # 1. get_current_user_strict unconditionally raises 401 if no Authorization header
        with pytest.raises(HTTPException) as exc_info:
            get_current_user_strict(db=db, auth_header=None)
        assert exc_info.value.status_code == 401

        # 2. When DEMO_MODE is False, get_current_user MUST reject unauthenticated requests with 401
        import backend.app.services.auth as auth_service
        monkeypatch.setattr(auth_service, "DEMO_MODE", False)
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(db=db, auth_header=None)
        assert exc_info.value.status_code == 401
        assert "Authentication credentials were not provided" in exc_info.value.detail

        # 3. When ENVIRONMENT is 'production', get_current_user MUST reject unauthenticated requests with 401
        monkeypatch.setattr(auth_service, "DEMO_MODE", True)
        monkeypatch.setattr(auth_service, "ENVIRONMENT", "production")
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(db=db, auth_header=None)
        assert exc_info.value.status_code == 401

        # 4. In production, missing or predictable JWT_SECRET_KEY raises RuntimeError
        import os
        old_env = os.environ.get("ENVIRONMENT")
        old_secret = os.environ.get("JWT_SECRET_KEY")
        try:
            os.environ["ENVIRONMENT"] = "production"
            os.environ["JWT_SECRET_KEY"] = "artisan_ai_dev_secret_key_marginalized_artisans_safety_first"
            # reloading config or testing logic
            import importlib
            import backend.app.config
            with pytest.raises(RuntimeError) as exc_config:
                importlib.reload(backend.app.config)
            assert "CRITICAL SECURITY CONFIGURATION ERROR" in str(exc_config.value)
        finally:
            if old_env:
                os.environ["ENVIRONMENT"] = old_env
            else:
                os.environ.pop("ENVIRONMENT", None)
            if old_secret:
                os.environ["JWT_SECRET_KEY"] = old_secret
            else:
                os.environ.pop("JWT_SECRET_KEY", None)
            import importlib
            import backend.app.config
            importlib.reload(backend.app.config)
    finally:
        db.close()

def test_seller_spoofing_prevention():
    uid = uuid.uuid4().hex[:6]
    # Register regular artisan user
    reg = client.post("/api/auth/register", json={
        "name": "Honest Weaver",
        "email": f"weaver.{uid}@artisanai.in",
        "phone": f"+91 95555 {uid[:5]}",
        "password": "Password123!",
        "role": "ARTISAN",
        "craft": "Handloom Weaving"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    user_id = reg.json()["user"]["id"]

    # Attempt to spoof seller_id = 999999
    prod_res = client.post("/api/products", json={
        "title": f"Spoofed Silk Scarf {uid}",
        "category": "Pochampally Ikat",
        "price": 1200.0,
        "stock": 5,
        "seller_id": 999999
    }, headers=headers)
    assert prod_res.status_code == 201
    created_prod = prod_res.json()
    # Server MUST override with authenticated user's id
    assert created_prod["seller_id"] == user_id
    assert created_prod["seller_id"] != 999999

def test_order_privacy_and_role_isolation():
    uid1 = uuid.uuid4().hex[:6]
    uid2 = uuid.uuid4().hex[:6]

    # Seller 1
    seller_reg = client.post("/api/auth/register", json={
        "name": f"Seller One {uid1}",
        "email": f"seller1.{uid1}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    seller_token = seller_reg.json()["access_token"]
    seller_headers = {"Authorization": f"Bearer {seller_token}"}
    seller_id = seller_reg.json()["user"]["id"]

    # Seller 1 creates Product
    prod = client.post("/api/products", json={
        "title": f"Private Craft {uid1}",
        "category": "Dokra",
        "price": 2000.0,
        "stock": 10
    }, headers=seller_headers).json()
    pid = prod["id"]

    # Buyer A
    buyer_reg = client.post("/api/auth/register", json={
        "name": f"Buyer Alpha {uid1}",
        "email": f"buyer.alpha.{uid1}@artisanai.in",
        "password": "Password123!",
        "role": "BUYER"
    })
    buyer_token = buyer_reg.json()["access_token"]
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

    # Buyer A orders Product
    order_res = client.post("/api/marketplace/order", json={
        "product_id": pid,
        "buyer_name": "Buyer Alpha",
        "quantity": 1,
        "delivery_address": "Alpha Secret Road, Delhi"
    }, headers=buyer_headers)
    assert order_res.status_code == 201

    # Buyer B (Another buyer)
    buyer2_reg = client.post("/api/auth/register", json={
        "name": f"Buyer Beta {uid2}",
        "email": f"buyer.beta.{uid2}@artisanai.in",
        "password": "Password123!",
        "role": "BUYER"
    })
    buyer2_token = buyer2_reg.json()["access_token"]
    buyer2_headers = {"Authorization": f"Bearer {buyer2_token}"}

    # Buyer B queries orders -> MUST NOT see Buyer A's order!
    buyer2_orders = client.get("/api/marketplace/orders", headers=buyer2_headers).json()
    assert all(o["delivery_address"] != "Alpha Secret Road, Delhi" for o in buyer2_orders)

    # Buyer A queries orders -> Can see their own order
    buyer1_orders = client.get("/api/marketplace/orders", headers=buyer_headers).json()
    assert any(o["delivery_address"] == "Alpha Secret Road, Delhi" for o in buyer1_orders)

    # Seller 1 queries orders -> Can see orders for their craft
    seller_orders = client.get("/api/marketplace/orders", headers=seller_headers).json()
    assert any(o["delivery_address"] == "Alpha Secret Road, Delhi" for o in seller_orders)

def test_telemetry_order_forgery_rejection():
    # Attempting to forge an ORDER event via generic /api/events must be rejected with 400
    res = client.post("/api/events", json={
        "event_type": "ORDER",
        "product_id": 1,
        "category": "Kalamkari"
    })
    assert res.status_code == 400
    assert "Direct submission" in res.json()["detail"]

def test_ai_catalog_large_base64_image_support():
    import uuid
    uid = uuid.uuid4().hex[:6]
    artisan_res = client.post("/api/auth/register", json={
        "name": f"Artisan {uid}",
        "email": f"artisan.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = artisan_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Simulating a camera capture or image file upload converted to Base64 (e.g. 10,000+ chars)
    dummy_base64 = "data:image/jpeg;base64," + ("A" * 15000)
    res = client.post("/api/ai/process-catalog", json={
        "voice_description": "Handcrafted terracotta water pot made with river clay",
        "language": "en",
        "image_url": dummy_base64,
        "material_cost": 150.0,
        "labour_cost": 200.0,
        "packaging_cost": 50.0
    }, headers=headers)
    # Must NOT fail with HTTP 422 Unprocessable Entity
    assert res.status_code == 200
    data = res.json()
    assert data["image_url"] == dummy_base64
    assert data["pricing_available"] is True

def test_enquiry_reply_flow():
    import uuid
    uid = str(uuid.uuid4())[:8]

    # Register Artisan
    artisan_reg = client.post("/api/auth/register", json={
        "name": f"Artisan ReplyTest {uid}",
        "email": f"artisan.reply.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    artisan_token = artisan_reg.json()["access_token"]
    artisan_headers = {"Authorization": f"Bearer {artisan_token}"}

    # Register Buyer
    buyer_reg = client.post("/api/auth/register", json={
        "name": f"Buyer ReplyTest {uid}",
        "email": f"buyer.reply.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "BUYER"
    })
    buyer_token = buyer_reg.json()["access_token"]
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

    # Artisan creates product
    prod_res = client.post("/api/products", json={
        "title": "Custom Kalamkari Wall Hanging",
        "category": "Kalamkari",
        "price": 3500.0,
        "stock": 2
    }, headers=artisan_headers)
    pid = prod_res.json()["id"]

    # Buyer submits wholesale enquiry
    enq_res = client.post("/api/marketplace/enquire", json={
        "product_id": pid,
        "quantity": 5,
        "message": "Can you customize this with peacocks?",
        "buyer_name": "Buyer ReplyTest",
        "buyer_phone": "+91 99999 88888"
    }, headers=buyer_headers)
    assert enq_res.status_code == 201

    enq_list = client.get("/api/marketplace/enquiries?role_view=seller", headers=artisan_headers).json()
    assert len(enq_list) > 0
    enq_id = enq_list[0]["id"]

    # Artisan sends reply
    reply_res = client.put(f"/api/marketplace/enquiries/{enq_id}/reply", json={
        "artisan_reply": "Yes, we can customize with peacocks in 10 days!"
    }, headers=artisan_headers)
    assert reply_res.status_code == 200
    assert reply_res.json()["artisan_reply"] == "Yes, we can customize with peacocks in 10 days!"

    # Buyer inspects enquiries and sees artisan reply
    buyer_enqs = client.get("/api/marketplace/enquiries?role_view=buyer", headers=buyer_headers).json()
    matching = [e for e in buyer_enqs if e["id"] == enq_id]
    assert len(matching) == 1
    assert matching[0]["artisan_reply"] == "Yes, we can customize with peacocks in 10 days!"

def test_order_delivery_tracking_status_progression():
    import uuid
    uid = str(uuid.uuid4())[:8]

    # Register Artisan & Buyer
    artisan_reg = client.post("/api/auth/register", json={
        "name": f"Artisan TrackTest {uid}",
        "email": f"artisan.track.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    artisan_headers = {"Authorization": f"Bearer {artisan_reg.json()['access_token']}"}

    buyer_reg = client.post("/api/auth/register", json={
        "name": f"Buyer TrackTest {uid}",
        "email": f"buyer.track.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "BUYER"
    })
    buyer_headers = {"Authorization": f"Bearer {buyer_reg.json()['access_token']}"}

    # Artisan creates product
    prod_res = client.post("/api/products", json={
        "title": "Channapatna Wooden Toy Car",
        "category": "Wooden Toys",
        "price": 450.0,
        "stock": 10
    }, headers=artisan_headers)
    pid = prod_res.json()["id"]

    # Buyer places order
    order_res = client.post("/api/marketplace/order", json={
        "product_id": pid,
        "quantity": 1,
        "delivery_address": "MG Road, Vijayawada"
    }, headers=buyer_headers)
    assert order_res.status_code == 201

    orders = client.get("/api/marketplace/orders?role_view=seller", headers=artisan_headers).json()
    ord_id = orders[0]["id"]
    assert orders[0]["status"] == "CONFIRMED"

    # Progression: CONFIRMED -> PROCESSING
    p1 = client.patch(f"/api/marketplace/orders/{ord_id}/status", json={"status": "PROCESSING"}, headers=artisan_headers)
    assert p1.status_code == 200
    assert p1.json()["status"] == "PROCESSING"

    # Progression: PROCESSING -> SHIPPED
    p2 = client.patch(f"/api/marketplace/orders/{ord_id}/status", json={"status": "SHIPPED"}, headers=artisan_headers)
    assert p2.status_code == 200
    assert p2.json()["status"] == "SHIPPED"

    # Progression: SHIPPED -> DELIVERED
    p3 = client.patch(f"/api/marketplace/orders/{ord_id}/status", json={"status": "DELIVERED"}, headers=artisan_headers)
    assert p3.status_code == 200
    assert p3.json()["status"] == "DELIVERED"

    # Buyer views order -> sees status DELIVERED
    b_orders = client.get("/api/marketplace/orders?role_view=buyer", headers=buyer_headers).json()
    assert b_orders[0]["status"] == "DELIVERED"

def test_seller_dashboard_analytics_endpoint():
    import uuid
    uid = str(uuid.uuid4())[:8]

    # Register Artisan
    artisan_reg = client.post("/api/auth/register", json={
        "name": f"Analytics Artisan {uid}",
        "email": f"artisan.dash.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    artisan_headers = {"Authorization": f"Bearer {artisan_reg.json()['access_token']}"}

    # Register Buyer
    buyer_reg = client.post("/api/auth/register", json={
        "name": f"Analytics Buyer {uid}",
        "email": f"buyer.dash.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "BUYER"
    })
    buyer_headers = {"Authorization": f"Bearer {buyer_reg.json()['access_token']}"}

    # Artisan creates product
    prod_res = client.post("/api/products", json={
        "title": f"Etikoppaka Lacquer Toy {uid}",
        "category": "Wooden Toys",
        "price": 500.0,
        "stock": 20
    }, headers=artisan_headers)
    pid = prod_res.json()["id"]

    # Buyer places order for 2 units
    order_res = client.post("/api/marketplace/order", json={
        "product_id": pid,
        "quantity": 2,
        "delivery_address": "Guntur, AP"
    }, headers=buyer_headers)
    assert order_res.status_code == 201

    # Fetch seller dashboard
    dash_res = client.get("/api/seller/dashboard", headers=artisan_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()

    assert dash_data["total_revenue"] == 1000.0
    assert dash_data["units_sold"] == 2
    assert dash_data["total_orders"] == 1
    assert "delivery_status" in dash_data
    assert dash_data["delivery_status"]["confirmed"] == 1
    assert len(dash_data["product_performance"]) >= 1

    per_prod = [p for p in dash_data["product_performance"] if p["product_id"] == pid]
    assert len(per_prod) == 1
    assert per_prod[0]["units_sold"] == 2
    assert per_prod[0]["revenue"] == 1000.0



