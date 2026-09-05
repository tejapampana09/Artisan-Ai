from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from backend.app.models import Product, Event
from backend.app.services.demand_engine import calculate_category_demand, BASELINE_MARKET_DEMAND

# Deterministic safety constraint bounds
MAX_UPWARD_ADJUSTMENT_PCT = 0.25   # Maximum +25% price increase in one cycle
MAX_DOWNWARD_ADJUSTMENT_PCT = 0.10 # Maximum -10% price decrease in one cycle
MIN_DEMAND_FACTOR = 0.95
MAX_DEMAND_FACTOR = 1.15
MIN_MARKET_ADJUSTMENT = 0.95
MAX_MARKET_ADJUSTMENT = 1.05

def compute_demand_factor(demand_pct: float) -> Tuple[float, str]:
    """
    Converts category demand surge percentage into a bounded pricing factor:
    - LOW DEMAND (< 20%): 0.95 – 1.00
    - MODERATE DEMAND (20% – 35%): 1.00 – 1.05
    - HIGH DEMAND (>= 35%): 1.05 – 1.15 (strictly capped at 1.15)
    """
    if demand_pct < 20:
        # Scale between 0.95 and 1.00
        factor = 0.95 + (demand_pct / 20.0) * 0.05
        label = "LOW DEMAND"
    elif demand_pct <= 35:
        # Scale between 1.00 and 1.05
        factor = 1.00 + ((demand_pct - 20.0) / 15.0) * 0.05
        label = "MODERATE DEMAND"
    else:
        # Scale between 1.05 and 1.15, strictly capped at 1.15
        factor = 1.05 + min(0.10, ((demand_pct - 35.0) / 40.0) * 0.10)
        label = "HIGH DEMAND"

    bounded_factor = max(MIN_DEMAND_FACTOR, min(MAX_DEMAND_FACTOR, round(factor, 3)))
    return bounded_factor, label

def compute_market_adjustment(
    current_price: float,
    benchmark_low: float,
    benchmark_high: float
) -> Tuple[float, str]:
    """
    Determines market adjustment factor and position:
    - BELOW MARKET (< benchmark_low): 1.04
    - WITHIN MARKET RANGE (benchmark_low <= price <= benchmark_high): 1.01
    - ABOVE MARKET (> benchmark_high): 0.98
    """
    if current_price < benchmark_low:
        pos = "BELOW MARKET"
        adj = 1.04
    elif current_price <= benchmark_high:
        pos = "WITHIN MARKET RANGE"
        adj = 1.01
    else:
        pos = "ABOVE MARKET"
        adj = 0.98

    bounded_adj = max(MIN_MARKET_ADJUSTMENT, min(MAX_MARKET_ADJUSTMENT, adj))
    return bounded_adj, pos

def calculate_price_recommendation(product: Product, db: Session) -> Dict[str, Any]:
    """
    Deterministic explainable dynamic pricing calculation:
    1. Minimum Fair Price = (Material + Labour + Packaging) * (1 + Min Margin %)
    2. Demand Factor: bounded [0.95, 1.15]
    3. Market Adjustment: bounded [0.95, 1.05]
    4. Safety Rule: Recommended Price >= Minimum Fair Price
    5. Capped bounds: Max +25% upward, Max -10% downward
    """
    # 1. Cost Basis & Minimum Fair Price
    cost_basis = round(product.material_cost + product.labour_cost + product.packaging_cost, 2)
    margin_pct = product.min_margin_pct if product.min_margin_pct is not None else 0.20
    minimum_fair_price = round(cost_basis * (1.0 + margin_pct))

    # 2. Category Demand & Benchmark Range
    all_demands = {d["category"]: d for d in calculate_category_demand(db)}
    cat_demand = all_demands.get(product.category)
    
    if cat_demand:
        demand_pct = cat_demand["demand_pct"]
        benchmark_low = float(cat_demand["benchmark_min"])
        benchmark_high = float(cat_demand["benchmark_max"])
    else:
        base_cat = BASELINE_MARKET_DEMAND.get(product.category, {"base_pct": 20, "benchmark_min": 800, "benchmark_max": 1200})
        demand_pct = base_cat["base_pct"]
        benchmark_low = float(base_cat["benchmark_min"])
        benchmark_high = float(base_cat["benchmark_max"])

    demand_factor, demand_label = compute_demand_factor(demand_pct)
    market_adj, market_pos = compute_market_adjustment(product.price, benchmark_low, benchmark_high)

    # 3. Raw Recommended Price Calculation
    # Base calculation starts from current price (or minimum fair price if current price is below safe margin)
    base_anchor = max(product.price, minimum_fair_price)
    raw_recommended = base_anchor * demand_factor * market_adj

    # 4. Apply Safety Constraints
    # Constraint A: Maximum upward limit
    max_upward_allowed = product.price * (1.0 + MAX_UPWARD_ADJUSTMENT_PCT)
    # Constraint B: Maximum downward limit
    min_downward_allowed = product.price * (1.0 - MAX_DOWNWARD_ADJUSTMENT_PCT)

    bounded_price = min(max_upward_allowed, max(min_downward_allowed, raw_recommended))

    # Constraint C: STRICT SAFETY RULE: Recommended Price >= Minimum Fair Price
    final_recommended = max(bounded_price, float(minimum_fair_price))

    # 5. Sensible Rupee Rounding (round to nearest ₹5 or ₹9 e.g. 1249, 1250)
    rounded_price = round(final_recommended / 5.0) * 5
    if rounded_price < minimum_fair_price:
        rounded_price = minimum_fair_price

    price_change_amount = round(rounded_price - product.price, 2)
    price_change_pct = round((price_change_amount / product.price * 100.0), 1) if product.price > 0 else 0.0

    # 6. Event context for reasoning
    save_count = db.query(Event).filter(Event.product_id == product.id, Event.event_type == "SAVE").count()
    enquiry_count = db.query(Event).filter(Event.product_id == product.id, Event.event_type == "ENQUIRY").count()

    # 7. Transparent Explainable Reasoning List
    reasoning: List[str] = [
        f"{product.category} market demand indicates {demand_pct}% surge ({demand_label}, factor {demand_factor}x).",
        f"Comparable craft market benchmark range is ₹{int(benchmark_low):,}–₹{int(benchmark_high):,} (Current position: {market_pos}).",
        f"Cost basis is ₹{cost_basis:,.0f} (Material: ₹{product.material_cost}, Labour: ₹{product.labour_cost}, Packaging: ₹{product.packaging_cost}).",
        f"Protected minimum fair price is ₹{minimum_fair_price:,.0f}, ensuring your configured {int(margin_pct * 100)}% minimum margin.",
    ]

    if save_count > 0 or enquiry_count > 0:
        reasoning.append(f"Recorded buyer interest velocity: {save_count} wishlist save(s) and {enquiry_count} active lead(s).")

    if price_change_amount > 0:
        reasoning.append(f"Suggested upward adjustment of ₹{price_change_amount:,.0f} (+{price_change_pct}%) captures high category demand while protecting sales conversion.")
    elif price_change_amount < 0:
        reasoning.append(f"Suggested downward adjustment of ₹{abs(price_change_amount):,.0f} ({price_change_pct}%) improves market competitiveness while remaining safely above minimum fair price.")
    else:
        reasoning.append("Current listing price matches optimal fair market valuation.")

    safety_constraints = {
        "minimum_fair_price_protected": True,
        "min_margin_percentage": int(margin_pct * 100),
        "max_upward_cap_applied": rounded_price >= max_upward_allowed,
        "max_upward_cap_pct": f"+{int(MAX_UPWARD_ADJUSTMENT_PCT * 100)}%",
        "demand_factor_capped_at_max": demand_factor >= MAX_DEMAND_FACTOR,
        "seller_approval_mandatory": True
    }

    return {
        "product_id": product.id,
        "product_title": product.title,
        "category": product.category,
        "current_price": product.price,
        "cost_basis": cost_basis,
        "minimum_fair_price": float(minimum_fair_price),
        "demand_factor": demand_factor,
        "market_adjustment": market_adj,
        "recommended_price": float(rounded_price),
        "market_range": {
            "low": benchmark_low,
            "high": benchmark_high
        },
        "current_market_position": market_pos,
        "price_change_amount": price_change_amount,
        "price_change_percentage": price_change_pct,
        "reasoning": reasoning,
        "safety_constraints": safety_constraints
    }
