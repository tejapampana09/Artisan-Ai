from typing import Dict, Any, List, Tuple
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session
from backend.app.models import Product, Event
from backend.app.services.demand_engine import calculate_category_demand, BASELINE_MARKET_DEMAND

# Deterministic safety constraint bounds
MAX_UPWARD_ADJUSTMENT_PCT = Decimal("0.25")   # Maximum +25% price increase in one cycle
MAX_DOWNWARD_ADJUSTMENT_PCT = Decimal("0.10") # Maximum -10% price decrease in one cycle
MIN_DEMAND_FACTOR = 0.95
MAX_DEMAND_FACTOR = 1.15
MIN_MARKET_ADJUSTMENT = 0.95
MAX_MARKET_ADJUSTMENT = 1.05

def to_decimal(val, default="0.00") -> Decimal:
    if val is None:
        return Decimal(default)
    return Decimal(str(val))

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
    return float(bounded_factor), label

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
    c_price = float(current_price)
    b_low = float(benchmark_low)
    b_high = float(benchmark_high)

    if c_price < b_low:
        pos = "BELOW MARKET"
        adj = 1.04
    elif c_price <= b_high:
        pos = "WITHIN MARKET RANGE"
        adj = 1.01
    else:
        pos = "ABOVE MARKET"
        adj = 0.98

    bounded_adj = max(MIN_MARKET_ADJUSTMENT, min(MAX_MARKET_ADJUSTMENT, adj))
    return float(bounded_adj), pos

def calculate_price_recommendation(product: Product, db: Session) -> Dict[str, Any]:
    """
    Deterministic explainable dynamic pricing calculation:
    1. Minimum Fair Price = (Material + Labour + Packaging) * (1 + Min Margin %)
    2. Demand Factor: bounded [0.95, 1.15]
    3. Market Adjustment: bounded [0.95, 1.05]
    4. Safety Rule: Recommended Price >= Minimum Fair Price
    5. Capped bounds: Max +25% upward, Max -10% downward
    """
    # 1. Cost Basis & Minimum Fair Price using Decimal arithmetic
    mat_cost = to_decimal(product.material_cost)
    lab_cost = to_decimal(product.labour_cost)
    pkg_cost = to_decimal(product.packaging_cost)
    cost_basis = (mat_cost + lab_cost + pkg_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    margin_pct = to_decimal(product.min_margin_pct, "0.20")
    minimum_fair_price = (cost_basis * (Decimal("1.0") + margin_pct)).quantize(Decimal("1.00"), rounding=ROUND_HALF_UP)

    # 2. Category Demand & Benchmark Range
    all_demands = {d["category"]: d for d in calculate_category_demand(db)}
    cat_demand = all_demands.get(product.category)
    
    if cat_demand:
        demand_pct = float(cat_demand["demand_pct"])
        benchmark_low = to_decimal(cat_demand["benchmark_min"])
        benchmark_high = to_decimal(cat_demand["benchmark_max"])
    else:
        base_cat = BASELINE_MARKET_DEMAND.get(product.category, {"base_pct": 20, "benchmark_min": 800, "benchmark_max": 1200})
        demand_pct = float(base_cat["base_pct"])
        benchmark_low = to_decimal(base_cat["benchmark_min"])
        benchmark_high = to_decimal(base_cat["benchmark_max"])

    curr_price = to_decimal(product.price)
    demand_factor, demand_label = compute_demand_factor(demand_pct)
    market_adj, market_pos = compute_market_adjustment(curr_price, benchmark_low, benchmark_high)

    # 3. Raw Recommended Price Calculation
    # Base calculation starts from current price (or minimum fair price if current price is below safe margin)
    base_anchor = max(curr_price, minimum_fair_price)
    raw_recommended = (base_anchor * Decimal(str(demand_factor)) * Decimal(str(market_adj))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # 4. Apply Safety Constraints
    # Constraint A: Maximum upward limit (+25%)
    max_upward_allowed = (curr_price * (Decimal("1.0") + MAX_UPWARD_ADJUSTMENT_PCT)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    # Constraint B: Maximum downward limit (-10%)
    min_downward_allowed = (curr_price * (Decimal("1.0") - MAX_DOWNWARD_ADJUSTMENT_PCT)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    bounded_price = min(max_upward_allowed, max(min_downward_allowed, raw_recommended))

    # Constraint C: STRICT SAFETY RULE: Recommended Price >= Minimum Fair Price
    final_recommended = max(bounded_price, minimum_fair_price)

    # 5. Sensible Rupee Rounding (round to nearest ₹5)
    rounded_price = (Decimal(round(float(final_recommended) / 5.0) * 5)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if rounded_price < minimum_fair_price:
        rounded_price = minimum_fair_price

    price_change_amount = (rounded_price - curr_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    price_change_pct = round((float(price_change_amount) / float(curr_price) * 100.0), 1) if curr_price > 0 else 0.0

    # 6. Event context for reasoning
    save_count = db.query(Event).filter(Event.product_id == product.id, Event.event_type == "SAVE").count()
    enquiry_count = db.query(Event).filter(Event.product_id == product.id, Event.event_type == "ENQUIRY").count()

    # 7. Transparent Explainable Reasoning List
    reasoning: List[str] = [
        f"{product.category} market demand indicates {demand_pct}% surge ({demand_label}, factor {float(demand_factor):.3f}x).",
        f"Comparable craft market benchmark range is ₹{int(benchmark_low):,}–₹{int(benchmark_high):,} (Current position: {market_pos}).",
        f"Cost basis is ₹{float(cost_basis):,.0f} (Material: ₹{float(mat_cost)}, Labour: ₹{float(lab_cost)}, Packaging: ₹{float(pkg_cost)}).",
        f"Protected minimum fair price is ₹{float(minimum_fair_price):,.0f}, ensuring your configured {int(float(margin_pct) * 100)}% minimum margin.",
    ]

    if save_count > 0 or enquiry_count > 0:
        reasoning.append(f"Recorded buyer interest velocity: {save_count} wishlist save(s) and {enquiry_count} active lead(s).")

    if price_change_amount > 0:
        reasoning.append(f"Suggested upward adjustment of ₹{float(price_change_amount):,.0f} (+{price_change_pct}%) captures high category demand while protecting sales conversion.")
    elif price_change_amount < 0:
        reasoning.append(f"Suggested downward adjustment of ₹{abs(float(price_change_amount)):,.0f} ({price_change_pct}%) improves market competitiveness while remaining safely above minimum fair price.")
    else:
        reasoning.append("Current listing price matches optimal fair market valuation.")

    safety_constraints = {
        "minimum_fair_price_protected": True,
        "min_margin_percentage": int(float(margin_pct) * 100),
        "max_upward_cap_applied": rounded_price >= max_upward_allowed,
        "max_upward_cap_pct": f"+{int(float(MAX_UPWARD_ADJUSTMENT_PCT) * 100)}%",
        "demand_factor_capped_at_max": demand_factor >= MAX_DEMAND_FACTOR,
        "seller_approval_mandatory": True
    }

    return {
        "product_id": product.id,
        "product_title": product.title,
        "category": product.category,
        "current_price": float(curr_price),
        "cost_basis": float(cost_basis),
        "minimum_fair_price": float(minimum_fair_price),
        "demand_factor": float(demand_factor),
        "market_adjustment": float(market_adj),
        "recommended_price": float(rounded_price),
        "market_range": {
            "low": float(benchmark_low),
            "high": float(benchmark_high)
        },
        "current_market_position": market_pos,
        "price_change_amount": float(price_change_amount),
        "price_change_percentage": price_change_pct,
        "reasoning": reasoning,
        "safety_constraints": safety_constraints
    }
