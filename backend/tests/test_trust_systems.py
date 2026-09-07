import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

@pytest.fixture
def test_user_headers():
    uid = uuid.uuid4().hex[:6]
    email = f"artisan.trust.{uid}@artisanai.in"
    reg = client.post("/api/auth/register", json={
        "name": "Master Artisan Trust",
        "email": email,
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = reg.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_artisan_public_profile(test_user_headers):
    # Fetch public profile for user 1
    res = client.get("/api/artisan/1")
    assert res.status_code == 200
    data = res.json()
    assert "id" in data
    assert "name" in data
    assert "verification_status" in data
    assert "average_rating" in data

def test_update_artisan_profile(test_user_headers):
    res = client.put("/api/artisan/profile", json={
        "bio": "Certified Kondapalli woodcraft master with 15 years experience.",
        "craft_specialization": "Wood Toys & Sculptures",
        "experience_years": 15,
        "location": "Vijayawada, AP"
    }, headers=test_user_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["experience_years"] == 15
    assert data["verification_status"] == "PROFILE_COMPLETE"

def test_product_search_and_filter():
    res = client.get("/api/products?search=Kondapalli&min_price=10.0&max_price=50000.0")
    assert res.status_code == 200
    products = res.json()
    assert isinstance(products, list)

def test_product_reviews_list():
    res = client.get("/api/products/1/reviews")
    assert res.status_code == 200
    reviews = res.json()
    assert isinstance(reviews, list)

def test_user_notifications(test_user_headers):
    res = client.get("/api/notifications", headers=test_user_headers)
    assert res.status_code == 200
    notifs = res.json()
    assert isinstance(notifs, list)
