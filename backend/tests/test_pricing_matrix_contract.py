import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from backend.app.config import MARKET_MEDIAN_WEIGHT, MIN_MARGIN_PCT
from backend.app.services.pricing_engine import (
    calculate_price_recommendation_from_inputs,
    CONFIG_MARKET_MEDIAN_WEIGHT
)
from backend.app.routes.ai_catalog import AICatalogRequest
from backend.app.main import app

client = TestClient(app)


def test_scenario_1_case_1_no_artisan_price_uses_market_median():
    """Case 1: No price provided -> recommended_price equals market median."""
    rec = calculate_price_recommendation_from_inputs(
        title="Handmade Clay Pot",
        category="Pottery",
        current_price=0.0,
        market_median=700.0,
        benchmark_low=600.0,
        benchmark_high=800.0
    )
    assert rec["pricing_available"] is True
    assert rec["safety_constraints"]["pricing_case"] == "CASE_1_PRICE_NOT_PROVIDED"
    assert rec["recommended_price"] == 700.0


def test_scenario_2_case_1_no_market_no_costs_returns_pricing_unavailable():
    """Case 1 edge case: No price, no market data, no costs -> pricing_available = False."""
    rec = calculate_price_recommendation_from_inputs(
        title="Unknown Craft Item",
        category="Crafts",
        current_price=0.0,
        material_cost=0.0,
        labour_cost=0.0,
        market_median=None
    )
    assert rec["pricing_available"] is False
    assert rec["recommended_price"] is None
    assert rec["safety_constraints"]["pricing_case"] == "CASE_1_PRICE_NOT_PROVIDED"


def test_scenario_3_case_2_artisan_price_below_market_moves_to_market_median():
    """Case 2: Artisan price below market -> move target recommendation to market median."""
    rec = calculate_price_recommendation_from_inputs(
        title="Terracotta Diya Set",
        category="Pottery",
        current_price=300.0,
        market_median=700.0,
        benchmark_low=600.0,
        benchmark_high=800.0
    )
    assert rec["pricing_available"] is True
    assert rec["safety_constraints"]["pricing_case"] == "CASE_2_BELOW_MARKET"
    assert rec["recommended_price"] == 700.0


def test_scenario_4_case_3_artisan_price_inside_market_preserves_artisan_price():
    """Case 3: Artisan price inside market range -> preserve artisan price exactly."""
    rec = calculate_price_recommendation_from_inputs(
        title="Wooden Elephant Carving",
        category="Woodwork",
        current_price=750.0,
        market_median=700.0,
        benchmark_low=600.0,
        benchmark_high=800.0
    )
    assert rec["pricing_available"] is True
    assert rec["safety_constraints"]["pricing_case"] == "CASE_3_INSIDE_MARKET"
    assert rec["recommended_price"] == 750.0


def test_scenario_5_case_4_artisan_price_above_market_preserves_price_and_flags_premium():
    """Case 4: Artisan price above market range -> preserve artisan price & set premium_positioning = True."""
    rec = calculate_price_recommendation_from_inputs(
        title="Silk Zari Saree",
        category="Textiles",
        current_price=1200.0,
        market_median=700.0,
        benchmark_low=600.0,
        benchmark_high=800.0
    )
    assert rec["pricing_available"] is True
    assert rec["safety_constraints"]["pricing_case"] == "CASE_4_ABOVE_MARKET"
    assert rec["recommended_price"] == 1200.0
    assert rec["safety_constraints"]["premium_positioning"] is True


def test_scenario_6_cost_floor_enforcement():
    """Cost floor: If costs are provided, final recommendation respects minimum fair price (cost basis + 20%)."""
    # Material 500, Labour 300, Pkg 100, Other 100 -> Cost basis 1000 -> Min fair price 1200
    rec = calculate_price_recommendation_from_inputs(
        title="Handcrafted Brass Lamp",
        category="Metalwork",
        current_price=400.0,  # Below market (Case 2)
        material_cost=500.0,
        labour_cost=300.0,
        packaging_cost=100.0,
        other_cost=100.0,
        min_margin_pct=0.20,
        market_median=700.0,  # Market median is 700, but cost floor is 1200
        benchmark_low=600.0,
        benchmark_high=800.0
    )
    assert rec["pricing_available"] is True
    assert rec["cost_basis"] == 1000.0
    assert rec["minimum_fair_price"] == 1200.0
    assert rec["recommended_price"] >= 1200.0  # Must be floored at 1200.0


def test_scenario_7_selling_price_pipeline_in_ai_catalog_request():
    """Verify AICatalogRequest schema accepts selling_price and validates correctly."""
    req_dict = {
        "title": "Kalamkari Fabric",
        "description": "Hand-dyed cotton fabric",
        "category": "Textiles",
        "selling_price": 650.0
    }
    req = AICatalogRequest(**req_dict)
    assert req.selling_price == 650.0


def test_scenario_8_config_median_weight_imported_from_config():
    """Verify config constants are properly imported and synchronized."""
    assert CONFIG_MARKET_MEDIAN_WEIGHT == MARKET_MEDIAN_WEIGHT
