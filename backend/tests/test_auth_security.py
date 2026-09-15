import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.tests.conftest import make_buyer, make_artisan_via_admin

client = TestClient(app)


# ── Marketplace Buyer Auth ────────────────────────────────────────────────────

def test_buyer_register_and_login():
    """Marketplace: register buyer -> login -> get MARKETPLACE/BUYER token."""
    uid = uuid.uuid4().hex[:6]
    email = f"buyer.{uid}@artisanai.in"
    pw = "BuyerPass123!"

    reg = client.post("/api/marketplace/auth/register", json={
        "name": "Auth Flow Buyer",
        "email": email,
        "password": pw
    })
    assert reg.status_code == 201
    data = reg.json()
    assert "access_token" in data
    assert data["auth_domain"] == "MARKETPLACE"
    assert data["session_type"] == "BUYER"
    assert data["token_type"].lower() == "bearer"

    login = client.post("/api/marketplace/auth/login", json={
        "email_or_phone": email,
        "password": pw
    })
    assert login.status_code == 200
    ldata = login.json()
    assert ldata["auth_domain"] == "MARKETPLACE"
    assert ldata["session_type"] == "BUYER"


def test_buyer_me_with_valid_token():
    """Marketplace /me returns buyer info for valid MARKETPLACE token."""
    _, _, _, headers = make_buyer(client)
    me = client.get("/api/marketplace/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["role"] == "BUYER"


def test_buyer_unauthenticated_me_rejected():
    """/marketplace/auth/me requires a valid MARKETPLACE token."""
    res = client.get("/api/marketplace/auth/me")
    assert res.status_code == 401


def test_buyer_invalid_token_rejected():
    """Garbage JWT -> 401 on protected Marketplace endpoint."""
    headers = {"Authorization": "Bearer not.a.jwt.token"}
    res = client.get("/api/marketplace/auth/me", headers=headers)
    assert res.status_code == 401


def test_artisan_cannot_login_via_marketplace():
    """Artisan account rejected at Marketplace Buyer login."""
    res = client.post("/api/marketplace/auth/login", json={
        "email_or_phone": "lakshmi@artisanai.in",
        "password": "ArtisanPass123!"
    })
    assert res.status_code == 403
    assert "buyer" in res.json()["detail"].lower() or "artisan" in res.json()["detail"].lower()


def test_buyer_cannot_login_via_studio(admin_headers):
    """Buyer account rejected at Studio Artisan login."""
    uid = uuid.uuid4().hex[:6]
    email = f"stub.buyer.{uid}@artisanai.in"
    pw = "BuyerPass123!"
    client.post("/api/marketplace/auth/register", json={
        "name": "Stub Buyer",
        "email": email,
        "password": pw
    })
    res = client.post("/api/studio/auth/login", json={
        "email_or_phone": email,
        "password": pw
    })
    assert res.status_code == 403
    assert "artisan" in res.json()["detail"].lower() or "buyer" in res.json()["detail"].lower()


def test_buyer_change_password_full_cycle():
    """Buyer can change password; old token/password rejected after."""
    email, old_pw, token, headers = make_buyer(client)

    change = client.post("/api/marketplace/auth/change-password", json={
        "current_password": old_pw,
        "new_password": "NewBuyer456!"
    }, headers=headers)
    assert change.status_code == 200
    assert "access_token" in change.json()

    # New credentials work
    new_login = client.post("/api/marketplace/auth/login", json={
        "email_or_phone": email,
        "password": "NewBuyer456!"
    })
    assert new_login.status_code == 200

    # Old password rejected
    old_login = client.post("/api/marketplace/auth/login", json={
        "email_or_phone": email,
        "password": old_pw
    })
    assert old_login.status_code == 401


def test_buyer_wrong_current_password_rejected():
    """change-password fails with 400 if current_password is wrong."""
    _, _, _, headers = make_buyer(client)
    res = client.post("/api/marketplace/auth/change-password", json={
        "current_password": "WrongPass999!",
        "new_password": "DoesntMatter456!"
    }, headers=headers)
    assert res.status_code == 400
    assert "incorrect" in res.json()["detail"].lower()


def test_google_auth_invalid_token_rejected():
    """Spoofed Google auth -> 401."""
    res = client.post("/api/marketplace/auth/google", json={
        "access_token": "fake_invalid_google_access_token"
    })
    assert res.status_code == 401
    assert "google authentication failed" in res.json()["detail"].lower()


# ── Artisan Studio Auth ───────────────────────────────────────────────────────

def test_artisan_login_via_studio():
    """Seeded artisan can login via Studio and gets ARTISAN_STUDIO domain token."""
    res = client.post("/api/studio/auth/login", json={
        "email_or_phone": "lakshmi@artisanai.in",
        "password": "ArtisanPass123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["auth_domain"] == "ARTISAN_STUDIO"
    assert data["session_type"] == "STUDIO"


def test_artisan_me_with_studio_token(artisan_headers):
    """/studio/auth/me returns artisan info for valid ARTISAN_STUDIO token."""
    me = client.get("/api/studio/auth/me", headers=artisan_headers)
    assert me.status_code == 200
    assert me.json()["role"] == "ARTISAN"


def test_artisan_me_with_buyer_token_rejected():
    """Buyer MARKETPLACE token cannot access /studio/auth/me (403)."""
    _, _, _, buyer_headers = make_buyer(client)
    res = client.get("/api/studio/auth/me", headers=buyer_headers)
    assert res.status_code == 403


def test_artisan_change_password(artisan_headers):
    """Artisan can change password via Studio endpoint."""
    change = client.post("/api/studio/auth/change-password", json={
        "current_password": "ArtisanPass123!",
        "new_password": "ArtisanNew456!"
    }, headers=artisan_headers)
    assert change.status_code == 200
    assert "access_token" in change.json()
    assert change.json()["auth_domain"] == "ARTISAN_STUDIO"


# ── Admin Auth ────────────────────────────────────────────────────────────────

def test_admin_login_returns_admin_domain_token():
    """Admin login returns ADMIN domain token."""
    res = client.post("/api/admin/auth/login", json={
        "email_or_phone": "admin@artisanai.in",
        "password": "AdminPass123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["auth_domain"] == "ADMIN"
    assert data["session_type"] == "ADMIN"


def test_admin_me_requires_admin_token(admin_headers):
    """/admin/auth/me works with Admin domain token."""
    me = client.get("/api/admin/auth/me", headers=admin_headers)
    assert me.status_code == 200
    assert me.json()["role"] == "ADMIN"


def test_buyer_token_cannot_access_admin_me():
    """MARKETPLACE Buyer token rejected at /admin/auth/me (403)."""
    _, _, _, buyer_headers = make_buyer(client)
    res = client.get("/api/admin/auth/me", headers=buyer_headers)
    assert res.status_code == 403


def test_artisan_token_cannot_access_admin_me(artisan_headers):
    """ARTISAN_STUDIO token rejected at /admin/auth/me (403)."""
    res = client.get("/api/admin/auth/me", headers=artisan_headers)
    assert res.status_code == 403


# ── Admin Endpoint Protection ─────────────────────────────────────────────────

def test_admin_create_seller_requires_admin_token(admin_headers):
    """Admin can create an artisan via /api/artisan/admin/create-seller."""
    uid = uuid.uuid4().hex[:6]
    res = client.post("/api/artisan/admin/create-seller", json={
        "name": f"New Artisan {uid}",
        "email": f"newartisan.{uid}@artisanai.in",
        "password": "NewArt123!",
        "craft": "Weaving"
    }, headers=admin_headers)
    assert res.status_code == 201
    assert res.json()["role"] == "ARTISAN"


def test_buyer_token_blocked_from_admin_create_seller():
    """Buyer token cannot create seller (403)."""
    _, _, _, buyer_headers = make_buyer(client)
    uid = uuid.uuid4().hex[:6]
    res = client.post("/api/artisan/admin/create-seller", json={
        "name": f"Attacker {uid}",
        "email": f"attacker.{uid}@artisanai.in",
        "password": "Attacker123!"
    }, headers=buyer_headers)
    assert res.status_code == 403


def test_no_public_artisan_self_registration():
    """Artisan Studio has no public /register — only admin can create artisans."""
    uid = uuid.uuid4().hex[:6]
    res = client.post("/api/studio/auth/register", json={
        "name": f"Self-reg Artisan {uid}",
        "email": f"selfreg.{uid}@artisanai.in",
        "password": "SelfReg123!"
    })
    # Should return 404 (route doesn't exist) or 405/400
    assert res.status_code in [404, 405, 422]


def test_no_public_admin_registration():
    """Admin Console has no public /register."""
    uid = uuid.uuid4().hex[:6]
    res = client.post("/api/admin/auth/register", json={
        "name": f"Admin Attacker {uid}",
        "email": f"adminreg.{uid}@artisanai.in",
        "password": "Attack123!"
    })
    assert res.status_code in [404, 405, 422]
