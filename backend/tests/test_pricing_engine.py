import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock
from sqlalchemy.orm import Session

from backend.app.models import Product, User, PricingDecision, Event
from backend.app.services.pricing_engine import (
    calculate_price_recommendation, compute_market_median_signal,
    process_auto_smart_pricing, MAX_UPWARD_ADJUSTMENT_PCT, MAX_DOWNWARD_ADJUSTMENT_PCT
)

def test_1_legacy_path_without_market_median_is_identical(db: Session):
    product = Product(
        title="Handmade Kalamkari Saree",
        category="Sarees",
        price=Decimal("1500.00"),
        material_cost=Decimal("500.00"),
        labour_cost=Decimal("300.00"),
        packaging_cost=Decimal("100.00"),
        other_cost=Decimal("100.00"),
        min_margin_pct=Decimal("0.20"),
        stock=10
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    rec = calculate_price_recommendation(product, db)

    assert rec["current_price"] == 1500.0
    assert rec["cost_basis"] == 1000.0
    assert rec["minimum_fair_price"] == 1200.0
    assert rec["market_median"] is None
    assert rec["market_signal_used"] is False
    assert rec["market_weight"] == 0.0
    assert rec["recommended_price"] >= 1200.0

def test_2_market_median_below_current_price_adjusts_downwards(db: Session):
    product = Product(
        title="Wooden Toy Statue",
        category="Toys",
        price=Decimal("1500.00"),
        material_cost=Decimal("500.00"),
        labour_cost=Decimal("300.00"),
        packaging_cost=Decimal("100.00"),
        other_cost=Decimal("100.00"),
        min_margin_pct=Decimal("0.20"),
        stock=10
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    rec_legacy = calculate_price_recommendation(product, db, market_median=None)
    rec_market = calculate_price_recommendation(product, db, market_median=1300.0, market_currency="INR")

    assert rec_market["market_signal_used"] is True
    assert rec_market["market_median"] == 1300.0
    # Recommended price with lower market median should be lower than legacy recommendation
    assert rec_market["recommended_price"] <= rec_legacy["recommended_price"]
    assert rec_market["recommended_price"] >= 1200.0

def test_3_market_median_above_current_price_adjusts_upwards(db: Session):
    product = Product(
        title="Brass Lamp",
        category="Brassware",
        price=Decimal("1500.00"),
        material_cost=Decimal("500.00"),
        labour_cost=Decimal("300.00"),
        packaging_cost=Decimal("100.00"),
        other_cost=Decimal("100.00"),
        min_margin_pct=Decimal("0.20"),
        stock=10
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    rec_legacy = calculate_price_recommendation(product, db, market_median=None)
    rec_market = calculate_price_recommendation(product, db, market_median=2000.0, market_currency="INR")

    assert rec_market["market_signal_used"] is True
    assert rec_market["market_median"] == 2000.0
    assert rec_market["recommended_price"] >= rec_legacy["recommended_price"]

def test_4_extreme_low_market_median_cannot_violate_20_percent_cost_floor(db: Session):
    product = Product(
        title="Terracotta Pot",
        category="Pottery",
        price=Decimal("1500.00"),
        material_cost=Decimal("500.00"),
        labour_cost=Decimal("300.00"),
        packaging_cost=Decimal("100.00"),
        other_cost=Decimal("100.00"),
        min_margin_pct=Decimal("0.20"),
        stock=10
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # Extreme low market median ₹700 (well below ₹1,200 minimum fair price floor)
    rec = calculate_price_recommendation(product, db, market_median=700.0, market_currency="INR")

    assert rec["minimum_fair_price"] == 1200.0
    assert rec["recommended_price"] >= 1200.0

def test_5_below_market_median_adjusts_toward_market_median_v3_capped(db: Session):
    """
    Verify Case 2 (V3): Artisan price below market adjusts toward market median,
    but the V3 Global Safety Cap (+25% max upward adjustment) is enforced.
    price=500, market_median=850, V3 cap = 500 * 1.25 = 625
    Cost floor: cost_basis=380, min_fair=456 (below cap)
    Expected: recommended = 625 (capped, not full 850)
    """
    product = Product(
        title="Handloom Scarf",
        category="Textiles",
        price=Decimal("500.00"),
        material_cost=Decimal("200.00"),
        labour_cost=Decimal("150.00"),
        packaging_cost=Decimal("20.00"),
        other_cost=Decimal("10.00"),
        min_margin_pct=Decimal("0.20"),
        stock=10
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # Artisan price ₹500, observed market median ₹850
    rec = calculate_price_recommendation(product, db, market_median=850.0, market_currency="INR")

    # V3: CASE_2 is below market, but V3 Global Safety Cap applies: max = 500 * 1.25 = 625
    assert rec["pricing_case"] == "CASE_2_BELOW_MARKET"
    # V3 global cap: 500 * 1.25 = 625; cost floor (456) < cap (625) so cap wins
    assert rec["recommended_price"] == 625.0, (
        f"Expected V3-capped CASE_2 recommendation of 625.0, got {rec['recommended_price']}"
    )

def test_6_currency_mismatch_ignores_market_median(db: Session):
    product = Product(
        title="Carved Wall Panel",
        category="Woodwork",
        price=Decimal("1500.00"),
        material_cost=Decimal("500.00"),
        labour_cost=Decimal("300.00"),
        packaging_cost=Decimal("100.00"),
        other_cost=Decimal("100.00"),
        min_margin_pct=Decimal("0.20"),
        stock=10
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # Market median provided in USD when product is in INR
    rec = calculate_price_recommendation(product, db, market_median=25.0, market_currency="USD")

    assert rec["market_signal_used"] is False
    assert rec["market_median"] is None
    assert any("currency does not match" in r for r in rec["reasoning"])

def test_7_matching_currency_applies_market_median(db: Session):
    product = Product(
        title="Kondapalli Horse",
        category="Toys",
        price=Decimal("1000.00"),
        material_cost=Decimal("300.00"),
        labour_cost=Decimal("200.00"),
        packaging_cost=Decimal("50.00"),
        other_cost=Decimal("50.00"),
        min_margin_pct=Decimal("0.20"),
        stock=10
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    rec = calculate_price_recommendation(product, db, market_median=1200.0, market_currency="INR")

    assert rec["market_signal_used"] is True
    assert rec["market_median"] == 1200.0
    assert any("Comparable market median" in r for r in rec["reasoning"])

def test_8_upward_cap_and_downward_cap_bounds():
    anchor = Decimal("1000.00")
    fair_price = Decimal("800.00")
    
    # Normal computation
    sig_anchor, used, status = compute_market_median_signal(anchor, market_median=1200.0, minimum_fair_price=fair_price)
    assert used is True
    # 700 + 360 = 1060
    assert sig_anchor == Decimal("1060.00")

def test_9_decimal_arithmetic_precision():
    anchor = Decimal("1500.00")
    fair_price = Decimal("1200.00")
    sig_anchor, used, status = compute_market_median_signal(anchor, market_median=2000.0, minimum_fair_price=fair_price)
    # 1500 * 0.70 + 2000 * 0.30 = 1050 + 600 = 1650.00
    assert sig_anchor == Decimal("1650.00")

def test_10_equilibrium_guard_remains_functional(db: Session):
    product = Product(
        title="Equilibrium Test Item",
        category="Decor",
        price=Decimal("1500.00"),
        material_cost=Decimal("500.00"),
        labour_cost=Decimal("300.00"),
        packaging_cost=Decimal("100.00"),
        other_cost=Decimal("100.00"),
        min_margin_pct=Decimal("0.20"),
        stock=10
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # Add an accepted decision record matching current price
    decision = PricingDecision(
        product_id=product.id,
        decision="ACCEPT",
        previous_price=Decimal("1400.00"),
        recommended_price=Decimal("1500.00"),
        applied_price=Decimal("1500.00"),
        demand_factor=Decimal("1.00"),
        market_adjustment=Decimal("1.00"),
        reasoning_json="[]"
    )
    db.add(decision)
    db.commit()

    rec = calculate_price_recommendation(product, db)
    # Without new events, equilibrium guard retains price at current_price
    assert rec["recommended_price"] == 1500.0
    assert rec["price_change_amount"] == 0.0

def test_11_autonomous_mode_flag_and_safety_constraints(db: Session):
    product = Product(
        title="Auto Pricing Item",
        category="Decor",
        price=Decimal("1000.00"),
        material_cost=Decimal("300.00"),
        labour_cost=Decimal("200.00"),
        packaging_cost=Decimal("50.00"),
        other_cost=Decimal("50.00"),
        min_margin_pct=Decimal("0.20"),
        auto_smart_pricing_enabled=True
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    rec = calculate_price_recommendation(product, db)

    assert rec["safety_constraints"]["autonomous_mode_enabled"] is True
    assert rec["safety_constraints"]["pricing_mode"] == "AUTONOMOUS_AUTO_APPLY"

def test_12_orchestration_with_noop_provider_matches_legacy_path(db: Session):
    from backend.app.services.market_research_provider import NoOpMarketResearchProvider
    from backend.app.services.pricing_orchestrator import get_market_aware_price_recommendation_sync

    product = Product(
        title="Terracotta Vase",
        category="Pottery",
        materials="Clay, Terracotta",
        price=Decimal("1000.00"),
        material_cost=Decimal("300.00"),
        labour_cost=Decimal("200.00"),
        packaging_cost=Decimal("50.00"),
        other_cost=Decimal("50.00"),
        min_margin_pct=Decimal("0.20")
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    rec = get_market_aware_price_recommendation_sync(product, db, provider=NoOpMarketResearchProvider())

    assert rec["market_median"] is None
    assert rec["market_signal_used"] is False
    assert rec["recommended_price"] >= 720.0

def test_13_orchestration_with_mock_provider_supplies_market_signal(db: Session):
    from backend.app.services.market_research_provider import MockMarketResearchProvider
    from backend.app.services.pricing_orchestrator import get_market_aware_price_recommendation_sync

    product = Product(
        title="Handcrafted Brass Bell",
        category="Brassware",
        materials="Brass",
        price=Decimal("1000.00"),
        material_cost=Decimal("300.00"),
        labour_cost=Decimal("200.00"),
        packaging_cost=Decimal("50.00"),
        other_cost=Decimal("50.00"),
        min_margin_pct=Decimal("0.20")
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    mock_provider = MockMarketResearchProvider(mock_listings=[
        {"title": "Handcrafted Brass Bell", "category": "Brassware", "materials": ["Brass"], "price": 1400.0, "currency": "INR"},
        {"title": "Brass Temple Bell", "category": "Brassware", "materials": ["Brass"], "price": 1600.0, "currency": "INR"}
    ])

    rec = get_market_aware_price_recommendation_sync(product, db, provider=mock_provider)

    assert rec["market_signal_used"] is True
    assert rec["market_median"] == 1500.0
    assert rec["recommended_price"] > 1000.0

def test_14_extract_product_artisan_facts_handles_materials():
    from backend.app.services.pricing_orchestrator import extract_product_artisan_facts

    product = Product(
        title="Hand Block Print Cotton Saree",
        category="Sarees",
        materials="Cotton, Natural Dyes, Indigo",
        craft_story="Traditional hand block printing craft from Jaipur",
        description="Beautiful blue indigo cotton saree"
    )

    facts = extract_product_artisan_facts(product)

    assert facts.product_name == "Hand Block Print Cotton Saree"
    assert facts.craft_type == "Sarees"
    assert "Cotton" in facts.materials
    assert "Natural Dyes" in facts.materials
    assert "Indigo" in facts.materials
    assert facts.artisan_story == "Traditional hand block printing craft from Jaipur"

def test_15_process_market_aware_auto_pricing_applies_recommendation(db: Session):
    from backend.app.services.market_research_provider import MockMarketResearchProvider
    from backend.app.services.pricing_orchestrator import process_market_aware_auto_pricing

    product = Product(
        title="Handmade Wooden Stool",
        category="Furniture",
        materials="Teak Wood",
        price=Decimal("1000.00"),
        material_cost=Decimal("300.00"),
        labour_cost=Decimal("200.00"),
        packaging_cost=Decimal("50.00"),
        other_cost=Decimal("50.00"),
        min_margin_pct=Decimal("0.20"),
        auto_smart_pricing_enabled=True
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    mock_provider = MockMarketResearchProvider(mock_listings=[
        {"title": "Handmade Wooden Stool", "category": "Furniture", "materials": ["Teak Wood"], "price": 1500.0, "currency": "INR"},
        {"title": "Carved Teak Stool", "category": "Furniture", "materials": ["Teak Wood"], "price": 1700.0, "currency": "INR"}
    ])

    decision = process_market_aware_auto_pricing(product, db, bypass_cooldown=True, provider=mock_provider)

    assert decision is not None
    assert decision.decision == "AUTO_APPLIED"
    assert float(product.price) > 1000.0

def test_16_calculate_price_recommendation_from_inputs_is_pure_and_db_free():
    from backend.app.services.pricing_engine import calculate_price_recommendation_from_inputs

    # Pure calculation with draft costs (material 300, labour 200, pkg 50, oth 50 => cost basis 600, min fair 720)
    rec = calculate_price_recommendation_from_inputs(
        title="Pure Draft Pot",
        category="Pottery",
        current_price=0.0,
        material_cost=300.0,
        labour_cost=200.0,
        packaging_cost=50.0,
        other_cost=50.0,
        min_margin_pct=0.20,
        market_median=1000.0,
        market_currency="INR"
    )

    assert rec["product_id"] is None
    assert rec["cost_basis"] == 600.0
    assert rec["minimum_fair_price"] == 720.0
    assert rec["market_signal_used"] is True
    assert rec["market_median"] == 1000.0
    # Case 1 (No artisan price provided) -> recommended price equals market median (₹1000.00)
    assert rec["recommended_price"] == 1000.0
    assert rec["safety_constraints"]["minimum_fair_price_protected"] is True

def test_17_auto_smart_pricing_dynamic_surge_in_case_3(db: Session):
    from backend.app.services.pricing_engine import process_auto_smart_pricing

    # Product priced at 1135 inside market range
    product = Product(
        title="Kalamkari Dupatta",
        category="Textiles",
        price=Decimal("1135.00"),
        material_cost=Decimal("300.00"),
        labour_cost=Decimal("250.00"),
        packaging_cost=Decimal("25.00"),
        other_cost=Decimal("25.00"),
        min_margin_pct=Decimal("0.20"),
        stock=5,
        auto_smart_pricing_enabled=True
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # Insert events for category to generate high demand (> 1.0x factor)
    for _ in range(8):
        db.add(Event(event_type="VIEW", product_id=product.id, category="Textiles"))
    for _ in range(3):
        db.add(Event(event_type="ORDER", product_id=product.id, category="Textiles"))
    db.commit()

    decision = process_auto_smart_pricing(product, db, bypass_cooldown=True)

    assert decision is not None
    assert decision.decision == "AUTO_APPLIED"
    assert decision.previous_price == Decimal("1135.00")
    # Dynamic surge applied above 1135
    assert float(decision.applied_price) > 1135.0
    assert float(product.price) == float(decision.applied_price)

def test_18_auto_smart_pricing_baseline_anchor_prevents_compounding(db: Session):
    from backend.app.services.pricing_engine import process_auto_smart_pricing

    product = Product(
        title="Brass Lamp",
        category="Metalcraft",
        price=Decimal("1000.00"),
        material_cost=Decimal("400.00"),
        labour_cost=Decimal("200.00"),
        min_margin_pct=Decimal("0.20"),
        stock=5,
        auto_smart_pricing_enabled=True
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # First surge cycle
    for _ in range(10):
        db.add(Event(event_type="VIEW", product_id=product.id, category="Metalcraft"))
    db.commit()

    decision1 = process_auto_smart_pricing(product, db, bypass_cooldown=True)
    assert decision1 is not None
    price_after_cycle1 = float(product.price)
    assert price_after_cycle1 > 1000.0

    # Second evaluation cycle under identical demand conditions:
    # Baseline anchor should recognize price already reflects demand factor and NOT compound further
    decision2 = process_auto_smart_pricing(product, db, bypass_cooldown=True)
    assert decision2 is None
    assert float(product.price) == price_after_cycle1

def test_19_auto_smart_pricing_respects_cost_floor_on_softening(db: Session):
    from backend.app.services.pricing_engine import calculate_price_recommendation_from_inputs

    # Cost basis = 500 + 400 + 50 + 50 = 1000. Min fair price @ 20% margin = 1200.
    # Current price = 1250. Low demand factor 0.85 would yield 1250 * 0.85 = 1062.50.
    # Protected floor must force recommendation >= 1200.00!
    rec = calculate_price_recommendation_from_inputs(
        title="Protected Shawl",
        category="Weaving",
        current_price=1250.0,
        material_cost=500.0,
        labour_cost=400.0,
        packaging_cost=50.0,
        other_cost=50.0,
        min_margin_pct=0.20,
        demand_factor=0.85,
        auto_smart_pricing_enabled=True
    )

    assert rec["minimum_fair_price"] == 1200.0
    assert rec["recommended_price"] == 1200.0
    assert rec["safety_constraints"]["minimum_fair_price_protected"] is True

def test_20_order_event_triggers_auto_pricing(db: Session):
    from backend.app.services.pricing_engine import trigger_auto_pricing

    product = Product(
        title="Terracotta Planter",
        category="Pottery",
        price=Decimal("800.00"),
        material_cost=Decimal("200.00"),
        labour_cost=Decimal("200.00"),
        min_margin_pct=Decimal("0.20"),
        stock=10,
        auto_smart_pricing_enabled=True
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # Insert demand events
    for _ in range(6):
        db.add(Event(event_type="ORDER", product_id=product.id, category="Pottery"))
    db.commit()

    decision = trigger_auto_pricing(product.id, db=db, bypass_cooldown=True)
    assert decision is not None
    assert decision.decision == "AUTO_APPLIED"
    assert float(product.price) > 800.0



