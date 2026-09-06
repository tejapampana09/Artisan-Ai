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
