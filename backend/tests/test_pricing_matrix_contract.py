import pytest
from decimal import Decimal
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient

from backend.app.config import MARKET_MEDIAN_WEIGHT, MIN_MARGIN_PCT
from backend.app.services.pricing_engine import (
    calculate_price_recommendation_from_inputs,
    CONFIG_MARKET_MEDIAN_WEIGHT
)
from backend.app.routes.ai_catalog import AICatalogRequest
from backend.app.schemas import MarketResearchResponse, MarketSummary
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


def test_scenario_3_exact_boundary_matrix_cases():
    """
    Exact SIH-compliant Market Boundary Test Matrix:
    Market range = ₹600 - ₹800, Median = ₹700
    - ₹599 -> BELOW -> recommend ₹700
    - ₹600 -> INSIDE -> preserve ₹600
    - ₹700 -> INSIDE -> preserve ₹700
    - ₹800 -> INSIDE -> preserve ₹800
    - ₹801 -> ABOVE -> preserve ₹801 & premium_positioning = True
    """
    low, high, med = 600.0, 800.0, 700.0

    # 1. Below (₹599)
    r599 = calculate_price_recommendation_from_inputs("P", "C", current_price=599.0, market_median=med, benchmark_low=low, benchmark_high=high)
    assert r599["safety_constraints"]["pricing_case"] == "CASE_2_BELOW_MARKET"
    assert r599["recommended_price"] == 700.0

    # 2. Inside Low Boundary (₹600)
    r600 = calculate_price_recommendation_from_inputs("P", "C", current_price=600.0, market_median=med, benchmark_low=low, benchmark_high=high)
    assert r600["safety_constraints"]["pricing_case"] == "CASE_3_INSIDE_MARKET"
    assert r600["recommended_price"] == 600.0

    # 3. Inside Median (₹700)
    r700 = calculate_price_recommendation_from_inputs("P", "C", current_price=700.0, market_median=med, benchmark_low=low, benchmark_high=high)
    assert r700["safety_constraints"]["pricing_case"] == "CASE_3_INSIDE_MARKET"
    assert r700["recommended_price"] == 700.0

    # 4. Inside High Boundary (₹800)
    r800 = calculate_price_recommendation_from_inputs("P", "C", current_price=800.0, market_median=med, benchmark_low=low, benchmark_high=high)
    assert r800["safety_constraints"]["pricing_case"] == "CASE_3_INSIDE_MARKET"
    assert r800["recommended_price"] == 800.0

    # 5. Above (₹801)
    r801 = calculate_price_recommendation_from_inputs("P", "C", current_price=801.0, market_median=med, benchmark_low=low, benchmark_high=high)
    assert r801["safety_constraints"]["pricing_case"] == "CASE_4_ABOVE_MARKET"
    assert r801["recommended_price"] == 801.0
    assert r801["safety_constraints"]["premium_positioning"] is True


def test_scenario_4_cost_floor_enforcement():
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


def test_scenario_5_selling_price_schema_and_validation():
    """Verify AICatalogRequest schema accepts selling_price and validates correctly."""
    req_dict = {
        "title": "Kalamkari Fabric",
        "description": "Hand-dyed cotton fabric",
        "category": "Textiles",
        "selling_price": 650.0
    }
    req = AICatalogRequest(**req_dict)
    assert req.selling_price == 650.0


@patch("backend.app.routes.ai_catalog.get_current_user")
@patch("backend.app.services.catalog_orchestrator.generate_catalog_draft")
@patch("backend.app.services.catalog_orchestrator.research_market")
def test_scenario_6_e2e_selling_price_pipeline_reaches_pricing_engine(
    mock_research,
    mock_generate,
    mock_user
):
    """
    Full End-to-End API Integration Test:
    POST /api/ai/process-catalog with selling_price = 650.0
    Proves: selling_price -> AICatalogRequest -> process_full_catalog_pipeline -> pricing_engine!
    """
    mock_user_obj = MagicMock()
    mock_user_obj.id = 1
    mock_user.return_value = mock_user_obj

    mock_generate.return_value = {
        "title": "Handcrafted Silk Shawl",
        "category": "Textiles",
        "materials": "Silk",
        "description": "Beautiful handwoven silk shawl",
        "craft_story": "Woven by traditional artisans",
        "title_en": "Handcrafted Silk Shawl",
        "description_en": "Beautiful handwoven silk shawl",
        "craft_story_en": "Woven by traditional artisans",
        "translations": None,
        "tags": ["silk", "shawl"],
        "image_url": "https://example.com/shawl.jpg",
        "enhanced_image_url": "https://example.com/shawl_enhanced.jpg"
    }

    mock_mkt_resp = MarketResearchResponse(
        query="Handcrafted Silk Shawl Textiles",
        results=[],
        summary=MarketSummary(
            comparable_count=5,
            priced_comparable_count=5,
            is_reliable=True,
            market_confidence="HIGH",
            min_price=600.0,
            max_price=800.0,
            median_price=700.0,
            currency="INR"
        ),
        notice=None
    )
    mock_research.return_value = mock_mkt_resp

    payload = {
        "voice_description": "Handwoven silk shawl",
        "category_hint": "Textiles",
        "selling_price": 650.0
    }

    response = client.post("/api/ai/process-catalog", json=payload)
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"

    data = response.json()
    assert "price_recommendation" in data
    price_rec = data["price_recommendation"]

    # Proves selling_price reached pricing engine through the full pipeline!
    assert price_rec["current_price"] == 650.0
    assert price_rec["recommended_price"] == 650.0
    assert price_rec["safety_constraints"]["pricing_case"] == "CASE_3_INSIDE_MARKET"


def test_scenario_7_config_median_weight_imported_from_config():
    """Verify config constants are properly imported and synchronized."""
    assert CONFIG_MARKET_MEDIAN_WEIGHT == MARKET_MEDIAN_WEIGHT


def test_unreliable_market_with_artisan_price_preserves_artisan_price():
    """Unreliable market data + artisan price provided -> preserve artisan price exactly."""
    rec = calculate_price_recommendation_from_inputs(
        title="Artisan Stool",
        category="Furniture",
        current_price=850.0,
        market_median=1200.0,
        market_is_reliable=False
    )
    assert rec["market_signal_used"] is False
    assert rec["recommended_price"] == 850.0
    assert rec["safety_constraints"]["pricing_case"] == "CASE_3_INSIDE_MARKET"


def test_unreliable_market_without_artisan_price_uses_cost_floor_fallback():
    """Unreliable market data + no artisan price + costs provided -> recommendation falls back to cost floor."""
    # Material 300 + Labour 200 -> Cost basis 500 -> Min fair price 600
    rec = calculate_price_recommendation_from_inputs(
        title="Artisan Stool",
        category="Furniture",
        current_price=0.0,
        material_cost=300.0,
        labour_cost=200.0,
        market_median=1200.0,
        market_is_reliable=False
    )
    assert rec["market_signal_used"] is False
    assert rec["cost_basis"] == 500.0
    assert rec["minimum_fair_price"] == 600.0
    assert rec["recommended_price"] == 600.0
    assert rec["safety_constraints"]["pricing_case"] == "CASE_1_PRICE_NOT_PROVIDED"

