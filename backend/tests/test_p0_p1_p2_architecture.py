import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.tests.conftest import TestingSessionLocal
from backend.app.models import Product, User

from backend.app.services.pricing_engine import calculate_price_recommendation

client = TestClient(app)

def test_other_cost_and_protected_floor_calculation():
    """
    Verifies that cost_basis includes (material_cost + labour_cost + packaging_cost + other_cost)
    and that minimum_fair_price is strictly cost_basis * 1.20 with Decimal arithmetic.
    """
    db = TestingSessionLocal()

    try:
        prod = Product(
            title="Test Protected Craft",
            category="Kalamkari",
            price=1500.0,
            material_cost=400.0,
            labour_cost=300.0,
            packaging_cost=100.0,
            other_cost=200.0,  # Total cost_basis = 1000.0
            min_margin_pct=0.20,
            status="PUBLISHED"
        )
        db.add(prod)
        db.commit()
        db.refresh(prod)

        rec = calculate_price_recommendation(prod, db)

        # Minimum fair price = 1000 * 1.20 = 1200.0
        assert float(rec["minimum_fair_price"]) == 1200.0
        # Recommended price must be >= 1200.0
        assert float(rec["recommended_price"]) >= 1200.0
        assert rec["safety_constraints"]["minimum_fair_price_protected"] is True

    finally:
        db.close()


def test_toggle_smart_pricing_endpoint():
    """
    Verifies that POST/PATCH /api/products/{id}/toggle-smart-pricing toggles auto_smart_pricing_enabled safely.
    """
    uid = uuid.uuid4().hex[:6]
    artisan_res = client.post("/api/auth/register", json={
        "name": f"Artisan {uid}",
        "email": f"artisan.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = artisan_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create product
    create_res = client.post("/api/products", json={
        "title": "Smart Pricing Product",
        "category": "Wooden Toys",
        "price": 800.0,
        "material_cost": 200.0,
        "labour_cost": 200.0,
        "packaging_cost": 50.0,
        "other_cost": 50.0,
        "auto_smart_pricing_enabled": False
    }, headers=headers)
    assert create_res.status_code == 201
    prod_data = create_res.json()
    pid = prod_data["id"]
    assert prod_data["auto_smart_pricing_enabled"] is False

    # Toggle to True
    toggle_res1 = client.patch(f"/api/products/{pid}/toggle-smart-pricing", headers=headers)
    assert toggle_res1.status_code == 200
    assert toggle_res1.json()["auto_smart_pricing_enabled"] is True

    # Toggle back to False
    toggle_res2 = client.patch(f"/api/products/{pid}/toggle-smart-pricing", headers=headers)
    assert toggle_res2.status_code == 200
    assert toggle_res2.json()["auto_smart_pricing_enabled"] is False

def test_ai_catalog_other_cost_pipeline():
    """
    Verifies Fix 1: /api/ai/process-catalog includes other_cost in AI catalog draft generation.
    """
    uid = uuid.uuid4().hex[:6]
    artisan_res = client.post("/api/auth/register", json={
        "name": f"Artisan {uid}",
        "email": f"artisan.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = artisan_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/ai/process-catalog", json={
        "voice_description": "Handcrafted Kalamkari Saree with natural dyes",
        "language": "en",
        "category_hint": "Kalamkari",
        "material_cost": 500.0,
        "labour_cost": 300.0,
        "packaging_cost": 100.0,
        "other_cost": 100.0  # Total cost_basis = 1000.0 => min_fair_price = 1200.0
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert float(data["other_cost"]) == 100.0
    assert float(data["min_fair_price"]) == 1200.0

def test_auto_smart_pricing_execution():
    """
    Verifies Fix 2: Autonomous price update & AUTO_APPLIED audit decision record creation when auto_smart_pricing_enabled is True.
    """
    uid = uuid.uuid4().hex[:6]
    artisan_res = client.post("/api/auth/register", json={
        "name": f"Smart Artisan {uid}",
        "email": f"smart.artisan.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = artisan_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create product with low initial price (500) but cost_basis = 1000 (min_fair = 1200)
    create_res = client.post("/api/products", json={
        "title": "Autonomous Smart Pricing Craft",
        "category": "Kalamkari",
        "price": 500.0,
        "material_cost": 500.0,
        "labour_cost": 300.0,
        "packaging_cost": 100.0,
        "other_cost": 100.0,
        "auto_smart_pricing_enabled": True
    }, headers=headers)
    assert create_res.status_code == 201
    pid = create_res.json()["id"]

    # Trigger evaluation endpoint
    eval_res = client.post(f"/api/products/{pid}/evaluate-auto-pricing", headers=headers)
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["auto_pricing_applied"] is True
    assert eval_data["current_price"] == 625.0
    assert eval_data["decision"] == "AUTO_APPLIED"

def test_run_all_cycles_requires_admin_auth():
    """
    Verifies Issue 1: POST /api/products/auto-pricing/run-all-cycles is protected and requires ADMIN auth.
    """
    # 1. Unauthenticated -> 401/403 Forbidden
    unauth_res = client.post("/api/products/auto-pricing/run-all-cycles")
    assert unauth_res.status_code in (401, 403)

    # 2. Artisan (Non-admin) -> 403
    uid = uuid.uuid4().hex[:6]
    artisan_res = client.post("/api/auth/register", json={
        "name": f"Regular Artisan {uid}",
        "email": f"artisan.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = artisan_res.json()["access_token"]
    artisan_headers = {"Authorization": f"Bearer {token}"}
    forbidden_res = client.post("/api/products/auto-pricing/run-all-cycles", headers=artisan_headers)
    assert forbidden_res.status_code == 403

def test_other_cost_reasoning_and_dynamic_safety_metadata():
    """
    Verifies Issue 3 & Issue 5: reasoning string lists Other costs and safety_constraints dynamically reflect auto mode.
    """
    db = TestingSessionLocal()

    try:
        prod = Product(
            title="Reasoning Craft",
            category="Wooden Toys",
            price=1000.0,
            material_cost=400.0,
            labour_cost=300.0,
            packaging_cost=100.0,
            other_cost=200.0,
            min_margin_pct=0.20,
            auto_smart_pricing_enabled=True,
            status="PUBLISHED"
        )
        db.add(prod)
        db.commit()
        db.refresh(prod)

        rec = calculate_price_recommendation(prod, db)
        
        # Verify Issue 5: Reasoning includes Other costs
        reasoning_text = " ".join(rec["reasoning"])
        assert "Other: ₹200" in reasoning_text

        # Verify Issue 3: seller_approval_mandatory is False when auto mode is enabled
        assert rec["safety_constraints"]["seller_approval_mandatory"] is False
        assert rec["safety_constraints"]["autonomous_mode_enabled"] is True
        assert rec["safety_constraints"]["pricing_mode"] == "AUTONOMOUS_AUTO_APPLY"

    finally:
        db.close()


def test_rate_limiting_and_refined_equilibrium_guard():
    """
    Verifies that rate limiting check raises HTTP 429 when max_requests exceeded on pricing endpoints,
    and that equilibrium guard requires direct product events or >= 5 category events to break equilibrium.
    """
    from fastapi import HTTPException
    from backend.app.services.rate_limiter import rate_limiter
    from backend.app.models import Event, PricingDecision
    from datetime import datetime, timezone, timedelta
    from decimal import Decimal

    # 1. Test Rate Limiter exception when limit exceeded
    with pytest.raises(HTTPException) as exc_info:
        for _ in range(6):
            rate_limiter.check_rate_limit("test_rate_limit:eval_auto", max_requests=5, window_seconds=60)
    assert exc_info.value.status_code == 429

    # 2. Test Refined Equilibrium Guard
    db = TestingSessionLocal()
    try:
        prod = Product(
            title="Equilibrium Craft",
            category="Terracotta",
            price=1000.0,
            material_cost=300.0,
            labour_cost=200.0,
            packaging_cost=100.0,
            other_cost=0.0,
            status="PUBLISHED"
        )
        db.add(prod)
        db.commit()
        db.refresh(prod)

        # Add a decision record at current price
        decision = PricingDecision(
            product_id=prod.id,
            decision="ACCEPT",
            previous_price=Decimal("1000.00"),
            recommended_price=Decimal("1000.00"),
            applied_price=Decimal("1000.00"),
            demand_factor=Decimal("1.0000"),
            market_adjustment=Decimal("1.0000"),
            reasoning_json="[]",
            timestamp=datetime.now(timezone.utc) - timedelta(minutes=10)
        )
        db.add(decision)
        db.commit()

        # Add 2 category events (other products in same category) - should NOT break equilibrium (< 5)
        for _ in range(2):
            db.add(Event(
                category="Terracotta",
                product_id=prod.id + 999,
                event_type="VIEW",
                timestamp=datetime.now(timezone.utc) - timedelta(minutes=5)
            ))
        db.commit()

        rec = calculate_price_recommendation(prod, db)
        assert float(rec["recommended_price"]) == 1000.0
        assert float(rec["price_change_amount"]) == 0.0

        # Add direct product event - breaks equilibrium
        db.add(Event(
            category="Terracotta",
            product_id=prod.id,
            event_type="SAVE",
            timestamp=datetime.now(timezone.utc)
        ))
        db.commit()

        rec_after_event = calculate_price_recommendation(prod, db)
        assert rec_after_event is not None
    finally:
        db.close()



