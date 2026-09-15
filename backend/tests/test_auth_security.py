import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_register_and_login_flow():
    """Verify user registration and subsequent login with JWT token issue."""
    uid = uuid.uuid4().hex[:6]
    email = f"user.{uid}@artisanai.in"
    password = "Password123!"

    reg_res = client.post("/api/auth/register", json={
        "name": "Auth Flow Tester",
        "email": email,
        "password": password,
        "role": "ARTISAN"
    })
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["token_type"].lower() == "bearer"

    login_res = client.post("/api/auth/login", json={
        "email_or_phone": email,
        "password": password
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


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

    change_res = client.post("/api/auth/change-password", json={
        "current_password": "InitialPassword123!",
        "new_password": "UpdatedPassword456!"
    }, headers=headers)
    assert change_res.status_code == 200
    assert "access_token" in change_res.json()

    new_login = client.post("/api/auth/login", json={
        "email_or_phone": email,
        "password": "UpdatedPassword456!"
    })
    assert new_login.status_code == 200

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


def test_invalid_jwt_token_rejected():
    """Verify endpoints reject garbage JWT tokens with 401 Unauthorized."""
    headers = {"Authorization": "Bearer invalid.jwt.token.string"}
    res = client.get("/api/notifications", headers=headers)
    assert res.status_code == 401


def test_admin_self_registration_is_blocked():
    """Verify that public registration attempting to specify role='ADMIN' is blocked with 403 Forbidden."""
    uid = uuid.uuid4().hex[:6]
    res = client.post("/api/auth/register", json={
        "name": "Attacker Admin",
        "email": f"attacker.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ADMIN"
    })
    assert res.status_code == 403
    assert "cannot be self-registered" in res.json()["detail"].lower()


def test_google_auth_spoofed_request_without_valid_token_returns_401():
    """Verify that unverified / spoofed Google auth requests are strictly rejected with 401."""
    res = client.post("/api/auth/google", json={
        "access_token": "fake_invalid_google_token",
        "role": "ARTISAN"
    })
    assert res.status_code == 401
    assert "google authentication failed" in res.json()["detail"].lower()


def test_admin_endpoints_require_admin_role():
    """Verify that /api/artisan/admin/sellers and /api/artisan/admin/create-seller require ADMIN role."""
    # 1. Non-admin buyer attempt
    buyer_email = f"buyer.{uuid.uuid4().hex[:6]}@artisanai.in"
    reg = client.post("/api/auth/register", json={
        "name": "Normal Buyer",
        "email": buyer_email,
        "password": "Password123!",
        "role": "BUYER"
    })
    buyer_token = reg.json()["access_token"]
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

    # Attempt to access admin endpoints
    res_list = client.get("/api/artisan/admin/sellers", headers=buyer_headers)
    assert res_list.status_code == 403
    assert "admin access required" in res_list.json()["detail"].lower()

    res_create = client.post("/api/artisan/admin/create-seller", json={
        "name": "Spoofed Artisan",
        "email": f"seller.{uuid.uuid4().hex[:6]}@artisanai.in",
        "password": "Password123!"
    }, headers=buyer_headers)
    assert res_create.status_code == 403
    assert "admin access required" in res_create.json()["detail"].lower()


def test_seller_login_blocks_buyer_accounts():
    """Verify that a BUYER account cannot log in via Seller Studio login (required_role='ARTISAN')."""
    buyer_email = f"buyer.{uuid.uuid4().hex[:6]}@artisanai.in"
    password = "SecurePassword123!"
    client.post("/api/auth/register", json={
        "name": "Test Customer",
        "email": buyer_email,
        "password": password,
        "role": "BUYER"
    })

    # Attempt login with required_role='ARTISAN' (as sent by Seller Studio Login)
    seller_attempt = client.post("/api/auth/login", json={
        "email_or_phone": buyer_email,
        "password": password,
        "required_role": "ARTISAN"
    })
    assert seller_attempt.status_code == 403
    assert "registered as a customer" in seller_attempt.json()["detail"].lower()

    # Normal login without seller restriction succeeds
    normal_attempt = client.post("/api/auth/login", json={
        "email_or_phone": buyer_email,
        "password": password
    })
    assert normal_attempt.status_code == 200
    assert normal_attempt.json()["user"]["role"] == "BUYER"

