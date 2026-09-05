from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.pricing_engine import (
    compute_demand_factor, 
    compute_market_adjustment,
    MAX_DEMAND_FACTOR,
    MIN_DEMAND_FACTOR
)

client = TestClient(app)

def test_explainable_dynamic_pricing_requirements():
    # Fetch a live product (e.g. Kalamkari Saree)
    prod_res = client.get("/api/products")
    assert prod_res.status_code == 200
    products = prod_res.json()
    assert len(products) > 0
    product = products[0]
    pid = product["id"]

    # 1. Test Minimum Fair Price Calculation
    # Cost Basis = Material + Labour + Packaging
    cost_basis = product["material_cost"] + product["labour_cost"] + product["packaging_cost"]
    margin_pct = product["min_margin_pct"]
    expected_min_fair = round(cost_basis * (1.0 + margin_pct))

    rec_res = client.get(f"/api/products/{pid}/price-recommendation")
    assert rec_res.status_code == 200
    rec = rec_res.json()

    assert rec["cost_basis"] == cost_basis
    assert rec["minimum_fair_price"] == expected_min_fair

    # 2. Test Margin Protection
    # Recommended price must yield a margin >= min_margin_pct
    actual_margin = (rec["recommended_price"] - rec["cost_basis"]) / rec["cost_basis"]
    assert actual_margin >= margin_pct - 0.01  # allow minor rounding delta

    # 3. Test Recommended Price NEVER falling below Minimum Fair Price
    assert rec["recommended_price"] >= rec["minimum_fair_price"]

    # 4. Test Demand Factors being Capped
    factor_extreme_low, _ = compute_demand_factor(-50)
    assert factor_extreme_low >= MIN_DEMAND_FACTOR
    assert factor_extreme_low <= 1.0

    factor_moderate, _ = compute_demand_factor(25)
    assert 1.00 <= factor_moderate <= 1.05

    factor_high, _ = compute_demand_factor(50)
    assert 1.05 <= factor_high <= MAX_DEMAND_FACTOR

    factor_extreme_high, _ = compute_demand_factor(500)
    assert factor_extreme_high == MAX_DEMAND_FACTOR  # strictly capped at 1.15

    # 5. Test Extreme Demand does not cause unreasonable price jumps
    # Even if demand is huge, upward change is capped at MAX_UPWARD_ADJUSTMENT_PCT (+25%)
    assert rec["price_change_percentage"] <= 25.0
    assert rec["price_change_percentage"] >= -10.0

    # 6. Test Market Adjustment
    adj_below, pos_below = compute_market_adjustment(current_price=1000, benchmark_low=1200, benchmark_high=1500)
    assert pos_below == "BELOW MARKET"
    assert adj_below == 1.04

    adj_within, pos_within = compute_market_adjustment(current_price=1350, benchmark_low=1200, benchmark_high=1500)
    assert pos_within == "WITHIN MARKET RANGE"
    assert adj_within == 1.01

    adj_above, pos_above = compute_market_adjustment(current_price=1650, benchmark_low=1200, benchmark_high=1500)
    assert pos_above == "ABOVE MARKET"
    assert adj_above == 0.98

    # 7 & 8 & 9. Test Seller REJECTS Recommendation: Price must NOT change
    original_price = product["price"]
    reject_res = client.post(f"/api/products/{pid}/price-decision", json={"decision": "REJECT"})
    assert reject_res.status_code == 200
    reject_data = reject_res.json()
    assert reject_data["decision"] == "REJECT"
    assert reject_data["applied_price"] == original_price

    # Verify in database that price is unchanged
    prod_after_reject = client.get(f"/api/products/{pid}").json()
    assert prod_after_reject["price"] == original_price

    # 10. Test Seller ACCEPTS Recommendation: Records decision and updates price
    target_rec_price = rec["recommended_price"]
    accept_res = client.post(f"/api/products/{pid}/price-decision", json={"decision": "ACCEPT"})
    assert accept_res.status_code == 200
    accept_data = accept_res.json()
    assert accept_data["decision"] == "ACCEPT"
    assert accept_data["previous_price"] == original_price
    assert accept_data["recommended_price"] == target_rec_price
    assert accept_data["applied_price"] == target_rec_price
    assert "timestamp" in accept_data

    # Verify in database that price was actually updated after explicit acceptance
    prod_after_accept = client.get(f"/api/products/{pid}").json()
    assert prod_after_accept["price"] == target_rec_price
