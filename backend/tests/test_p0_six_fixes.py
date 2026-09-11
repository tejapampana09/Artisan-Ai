import uuid
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.models import User, Product, Order, Event, Review
from backend.app.services.ai_adapter import build_production_manual_draft
from backend.app.services.pricing_engine import calculate_price_recommendation
from backend.app.services.ml_demand_engine import predict_product_demand

client = TestClient(app)

def test_1_ai_fallback_content_purity():
    """Verify manual draft fallback does not manufacture craft_story, materials, or fake enhanced_image_url."""
    draft = build_production_manual_draft(
        voice_description="Hand-carved wooden elephant craft",
        language="en",
        image_url="http://example.com/raw.jpg"
    )
    assert draft["craft_story"] == ""
    assert draft["materials"] == ""
    assert draft["description"] == "Hand-carved wooden elephant craft"
    assert draft["enhanced_image_url"] is None
    assert draft["lifecycle_state"] == "MANUAL_DRAFT"

def test_2_option_b_gradual_pricing_cap():
    """Verify Option B pricing cap: +25% max single-cycle increase when current price is below fair floor."""
    db = SessionLocal()
    try:
        seller = db.query(User).filter(User.role == "ARTISAN").first()
        if not seller:
            seller = User(name="Test Artisan", email="artisan_p0@test.com", role="ARTISAN")
            db.add(seller)
            db.commit()

        product = Product(
            title="Gradual Pricing Test Item",
            category="Wooden Toys",
            price=Decimal("100.00"),
            stock=10,
            material_cost=Decimal("200.00"),
            labour_cost=Decimal("200.00"),
            packaging_cost=Decimal("16.67"),
            other_cost=Decimal("0.00"),
            min_margin_pct=Decimal("0.20"), # Min fair price = 416.67 * 1.20 = 500.00
            seller_id=seller.id,
            status="PUBLISHED"
        )
        db.add(product)
        db.commit()
        db.refresh(product)

        rec = calculate_price_recommendation(product, db)
        assert rec["minimum_fair_price"] == 500.00
        # +25% cap on curr_price 100.00 = 125.00. Recommended price for cycle 1 MUST be 125.00
        assert rec["recommended_price"] == 125.00
        assert rec["price_change_amount"] == 25.00
        assert any("capped at +25%" in r for r in rec["reasoning"])
    finally:
        db.close()

def test_3_ml_demand_model_synthetic_transparency():
    """Verify ML demand model metadata explicitly identifies DOMAIN_INFORMED_SYNTHETIC_PROTOTYPE mode."""
    db = SessionLocal()
    try:
        product = db.query(Product).first()
        if product:
            pred = predict_product_demand(product, db)
            if pred.get("model_source") == "TRAINED_ML_MODEL":
                info = pred.get("model_info", {})
                assert info.get("training_mode") == "DOMAIN_INFORMED_SYNTHETIC_PROTOTYPE"
                assert "synthetic craft heuristics" in info.get("notice", "")
    finally:
        db.close()

def test_4_event_anti_abuse_deduplication():
    """Verify event telemetry deduplicates SAVE and rate-limits VIEW events per user/product."""
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"Buyer {uid}",
        "email": f"buyer_{uid}@test.com",
        "password": "Password123!",
        "role": "BUYER"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    try:
        prod = db.query(Product).first()
        assert prod is not None

        # 1st SAVE
        resp1 = client.post("/api/events", json={"event_type": "SAVE", "product_id": prod.id}, headers=headers)
        assert resp1.status_code == 201
        evt1_id = resp1.json()["id"]

        # 2nd SAVE (duplicate by same user for same product)
        resp2 = client.post("/api/events", json={"event_type": "SAVE", "product_id": prod.id}, headers=headers)
        assert resp2.status_code == 201
        assert resp2.json()["id"] == evt1_id # Returned existing SAVE event without creating duplicate

        # 1st VIEW
        resp_v1 = client.post("/api/events", json={"event_type": "VIEW", "product_id": prod.id}, headers=headers)
        assert resp_v1.status_code == 201
        view1_id = resp_v1.json()["id"]

        # 2nd VIEW within 1 hour
        resp_v2 = client.post("/api/events", json={"event_type": "VIEW", "product_id": prod.id}, headers=headers)
        assert resp_v2.status_code == 201
        assert resp_v2.json()["id"] == view1_id # Rate-limited, returned existing VIEW event
    finally:
        db.close()

def test_5_review_order_validation_and_uniqueness():
    """Verify supplied order_id must belong to delivered order for product and enforce single review per order."""
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"Review Buyer {uid}",
        "email": f"review_buyer_{uid}@test.com",
        "password": "Password123!",
        "role": "BUYER"
    })
    token = reg.json()["access_token"]
    buyer_id = reg.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    try:
        seller = db.query(User).filter(User.role == "ARTISAN").first()
        prod = Product(
            title=f"Review Test Craft {uid}",
            category="Kalamkari",
            price=Decimal("500.00"),
            stock=5,
            seller_id=seller.id if seller else None,
            status="PUBLISHED"
        )
        db.add(prod)
        db.commit()
        db.refresh(prod)

        # Create DELIVERED order for this buyer
        order = Order(
            product_id=prod.id,
            user_id=buyer_id,
            buyer_name=f"Review Buyer {uid}",
            quantity=1,
            unit_price=Decimal("500.00"),
            total_price=Decimal("500.00"),
            delivery_address="123 Craft Lane",
            status="DELIVERED"
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        # Attempt review with invalid order_id (e.g. 9999) -> Expect 400 Bad Request
        bad_resp = client.post(
            f"/api/products/{prod.id}/reviews",
            json={"order_id": 9999, "rating": 5, "comment": "Invalid order test"},
            headers=headers
        )
        assert bad_resp.status_code == 400
        assert "Invalid order_id" in bad_resp.json()["detail"]

        # Valid review with matching order_id -> Expect 201 Created
        good_resp = client.post(
            f"/api/products/{prod.id}/reviews",
            json={"order_id": order.id, "rating": 5, "comment": "Authentic master craft!"},
            headers=headers
        )
        assert good_resp.status_code == 201
        assert good_resp.json()["order_id"] == order.id

        # Duplicate review for same order_id -> Expect 400 Bad Request
        dup_resp = client.post(
            f"/api/products/{prod.id}/reviews",
            json={"order_id": order.id, "rating": 4, "comment": "Duplicate attempt"},
            headers=headers
        )
        assert dup_resp.status_code == 400
        assert "already been submitted for this order" in dup_resp.json()["detail"]
    finally:
        db.close()
