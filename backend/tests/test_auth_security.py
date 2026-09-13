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

