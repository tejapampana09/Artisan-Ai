import os
import sys
from pathlib import Path
import pytest

REPO_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Use in-memory SQLite for tests - always fresh schema, no stale columns
TEST_DB_URL = "sqlite:///:memory:"
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["DEMO_MODE"] = "true"

from backend.app.database import Base, get_db
import backend.app.database as db_module

test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

db_module.engine = test_engine
db_module.SessionLocal = TestingSessionLocal

from backend.app.main import app
import backend.app.main as main_module
main_module.engine = test_engine

@pytest.fixture(scope="function", autouse=True)
def setup_test_database():
    from backend.app.models import User, Product, Order, Enquiry, Event, PricingDecision, ProcessedOperation, AuditLog
    # In-memory: drop-and-recreate each test for full isolation
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    from backend.app.services.auth import hash_password
    from backend.app.seed import seed_sample_products
    with TestingSessionLocal() as session:
        # Seed default ARTISAN
        artisan = User(
            name="Lakshmi Devi",
            email="lakshmi@artisanai.in",
            hashed_password=hash_password("ArtisanPass123!"),
            role="ARTISAN",
            status="ACTIVE",
            location="Machilipatnam, Andhra Pradesh",
            craft="Hand-block Kalamkari",
            token_version=1
        )
        session.add(artisan)
        # Seed ADMIN user for admin endpoint tests
        admin = User(
            name="System Admin",
            email="admin@artisanai.in",
            hashed_password=hash_password("AdminPass123!"),
            role="ADMIN",
            status="ACTIVE",
            location="India",
            craft="Administration",
            token_version=1
        )
        session.add(admin)
        session.commit()
        session.refresh(artisan)
        seed_sample_products(session, artisan.id)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    yield

    app.dependency_overrides.clear()

@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ── V3 Domain Token Fixtures ─────────────────────────────────────────────────

@pytest.fixture
def artisan_token(db):
    """Returns a valid ARTISAN_STUDIO domain token for the seeded artisan."""
    from fastapi.testclient import TestClient
    client = TestClient(app)
    res = client.post("/api/studio/auth/login", json={
        "email_or_phone": "lakshmi@artisanai.in",
        "password": "ArtisanPass123!"
    })
    assert res.status_code == 200, f"artisan_token fixture failed: {res.text}"
    return res.json()["access_token"]


@pytest.fixture
def artisan_headers(artisan_token):
    """Returns Authorization headers for the seeded artisan (ARTISAN_STUDIO domain)."""
    return {"Authorization": f"Bearer {artisan_token}"}


@pytest.fixture
def admin_token(db):
    """Returns a valid ADMIN domain token for the seeded admin."""
    from fastapi.testclient import TestClient
    client = TestClient(app)
    res = client.post("/api/admin/auth/login", json={
        "email_or_phone": "admin@artisanai.in",
        "password": "AdminPass123!"
    })
    assert res.status_code == 200, f"admin_token fixture failed: {res.text}"
    return res.json()["access_token"]


@pytest.fixture
def admin_headers(admin_token):
    """Returns Authorization headers for the seeded admin (ADMIN domain)."""
    return {"Authorization": f"Bearer {admin_token}"}


def make_buyer(client_fixture, uid=None):
    """
    Helper to register a fresh Buyer and return (email, password, token, headers).
    Usage: email, pw, token, headers = make_buyer(client)
    """
    import uuid
    uid = uid or uuid.uuid4().hex[:6]
    email = f"buyer.{uid}@artisanai.in"
    password = "BuyerPass123!"
    res = client_fixture.post("/api/marketplace/auth/register", json={
        "name": f"Test Buyer {uid}",
        "email": email,
        "password": password
    })
    assert res.status_code == 201, f"make_buyer failed: {res.text}"
    token = res.json()["access_token"]
    return email, password, token, {"Authorization": f"Bearer {token}"}


def make_artisan_via_admin(client_fixture, admin_headers_arg, uid=None):
    """
    Helper to create a fresh Artisan via admin endpoint and return (email, password, studio_token, studio_headers).
    """
    import uuid
    uid = uid or uuid.uuid4().hex[:6]
    email = f"artisan.new.{uid}@artisanai.in"
    password = "NewArtisan123!"
    res = client_fixture.post("/api/artisan/admin/create-seller", json={
        "name": f"New Artisan {uid}",
        "email": email,
        "password": password,
        "craft": "Pottery"
    }, headers=admin_headers_arg)
    assert res.status_code == 201, f"make_artisan_via_admin failed: {res.text}"
    # Now login via studio
    login_res = client_fixture.post("/api/studio/auth/login", json={
        "email_or_phone": email,
        "password": password
    })
    assert login_res.status_code == 200, f"artisan studio login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    return email, password, token, {"Authorization": f"Bearer {token}"}

@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    return TestClient(app)
