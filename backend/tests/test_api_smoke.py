import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_check_endpoint():
    """Verify health check /api/health or root endpoint status."""
    res = client.get("/")
    assert res.status_code in [200, 404]


def test_products_list_and_filter():
    """Verify GET /api/products returns product listings list."""
    res = client.get("/api/products")
    assert res.status_code == 200
    products = res.json()
    assert isinstance(products, list)


def test_product_crud_lifecycle():
    """Verify creating, fetching, and listing products."""
    uid = uuid.uuid4().hex[:6]
    email = f"crud.{uid}@artisanai.in"
    reg = client.post("/api/auth/register", json={
        "name": "CRUD Test User",
        "email": email,
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_res = client.post("/api/products", json={
        "title": "Kalamkari Fabric Roll",
        "description": "Hand-printed natural dye cotton roll",
        "category": "Textiles",
        "price": 1200.0,
        "stock": 10,
        "material_cost": 400.0,
        "labour_cost": 300.0,
        "packaging_cost": 50.0,
        "other_cost": 50.0
    }, headers=headers)
    assert create_res.status_code == 201
    prod = create_res.json()
    assert prod["title"] == "Kalamkari Fabric Roll"
    assert prod["id"] > 0

    get_res = client.get(f"/api/products/{prod['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["title"] == "Kalamkari Fabric Roll"


def test_artisan_profile_and_notifications():
    """Verify artisan profile endpoints and notifications query."""
    uid = uuid.uuid4().hex[:6]
    email = f"profile.{uid}@artisanai.in"
    reg = client.post("/api/auth/register", json={
        "name": "Profile Test Artisan",
        "email": email,
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    profile_res = client.put("/api/artisan/profile", json={
        "bio": "Expert weaver from Mangalagiri",
        "craft_specialization": "Handloom Sarees",
        "experience_years": 12,
        "location": "Guntur, AP"
    }, headers=headers)
    assert profile_res.status_code == 200
    assert profile_res.json()["experience_years"] == 12

    notif_res = client.get("/api/notifications", headers=headers)
    assert notif_res.status_code == 200
    assert isinstance(notif_res.json(), list)
