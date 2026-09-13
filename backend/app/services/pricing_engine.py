from typing import Dict, Any, List, Tuple, Optional, cast
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session
from backend.app.models import Product, Event, PricingDecision
from backend.app.services.demand_engine import calculate_category_demand

from backend.app.config import (
    MIN_MARGIN_PCT, MARKET_MEDIAN_WEIGHT as CONFIG_MARKET_MEDIAN_WEIGHT,
    MAX_UPWARD_ADJUSTMENT_PCT as CONFIG_MAX_UPWARD_ADJUSTMENT_PCT,
    MAX_DOWNWARD_ADJUSTMENT_PCT as CONFIG_MAX_DOWNWARD_ADJUSTMENT_PCT,
    MIN_DEMAND_FACTOR as CONFIG_MIN_DEMAND_FACTOR,
    MAX_DEMAND_FACTOR as CONFIG_MAX_DEMAND_FACTOR
)

# Deterministic safety constraint bounds derived from centralized config
MAX_UPWARD_ADJUSTMENT_PCT = Decimal(str(CONFIG_MAX_UPWARD_ADJUSTMENT_PCT))
MAX_DOWNWARD_ADJUSTMENT_PCT = Decimal(str(CONFIG_MAX_DOWNWARD_ADJUSTMENT_PCT))
MIN_DEMAND_FACTOR = CONFIG_MIN_DEMAND_FACTOR
MAX_DEMAND_FACTOR = CONFIG_MAX_DEMAND_FACTOR
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
    benchmark_low: Any,
    benchmark_high: Any
) -> Tuple[float, str]:
    """
    Determines market adjustment factor and position:
    - If no benchmark exists yet: 1.00 (Neutral)
    - BELOW MARKET (< benchmark_low): 1.04
    - WITHIN MARKET RANGE (benchmark_low <= price <= benchmark_high): 1.01
    - ABOVE MARKET (> benchmark_high): 0.98
    """
    if benchmark_low is None or benchmark_high is None:
        return 1.0, "INITIAL CATEGORY LISTING"

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

MARKET_MEDIAN_WEIGHT = Decimal("0.30")

def compute_market_median_signal(
    base_anchor: Decimal,
    market_median: Optional[Any] = None,
    minimum_fair_price: Optional[Decimal] = None,
    product_currency: str = "INR",
    market_currency: Optional[str] = None
) -> Tuple[Optional[Decimal], bool, Optional[str]]:
    """
    Computes a market-aware pricing anchor (70% base_anchor + 30% market_median)
    while enforcing currency matching and protected minimum fair price floor.
    Returns (market_anchor, signal_used, status_code).
    """
    if market_median is None:
        return None, False, "NO_MARKET_DATA"

    try:
        med_dec = to_decimal(market_median)
        if med_dec <= 0:
            return None, False, "INVALID_MARKET_MEDIAN"
    except Exception:
        return None, False, "INVALID_MARKET_MEDIAN"

    prod_curr = (product_currency or "INR").upper().strip()
    mkt_curr = (market_currency or "INR").upper().strip()
    if market_currency is not None and mkt_curr != prod_curr:
        return None, False, "CURRENCY_MISMATCH"

    market_anchor = (base_anchor * (Decimal("1.0") - MARKET_MEDIAN_WEIGHT)) + (med_dec * MARKET_MEDIAN_WEIGHT)
    
    if minimum_fair_price is not None:
        market_anchor = max(market_anchor, minimum_fair_price)

    return market_anchor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), True, "SUCCESS"

def calculate_price_recommendation_from_inputs(
    title: str,
    category: str,
    current_price: Any = 0.0,
    material_cost: Any = 0.0,
    labour_cost: Any = 0.0,
    packaging_cost: Any = 0.0,
    other_cost: Any = 0.0,
    min_margin_pct: Any = 0.20,
    market_median: Optional[Any] = None,
    market_currency: Optional[str] = None,
    product_currency: str = "INR",
    demand_pct: float = 0.0,
    demand_factor: float = 1.0,
    demand_label: str = "MODERATE DEMAND",
    benchmark_low: Optional[Any] = None,
    benchmark_high: Optional[Any] = None,
    save_count: int = 0,
    enquiry_count: int = 0,
    auto_smart_pricing_enabled: bool = False,
    product_id: Optional[int] = None,
    ml_info: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Pure deterministic dynamic pricing calculation implementing the 4-case Decision Tree:
    
    1. Costs are OPTIONAL. If provided (cost_basis > 0), minimum_fair_price = cost_basis * (1 + margin_pct).
       If omitted (cost_basis == 0), minimum_fair_price = 0.0.
    2. Case 1 (No artisan price): Recommended = Market Median (or market-aware recommendation).
    3. Case 2 (Artisan price below market): Adjust toward market median / bounded market-aware price.
    4. Case 3 (Artisan price inside market range): Preserve artisan price!
    5. Case 4 (Artisan price above market range): Preserve artisan price & flag premium positioning!
    6. Cost floor: If costs are available, recommendation >= minimum_fair_price.
    """
    mat_cost = to_decimal(material_cost)
    lab_cost = to_decimal(labour_cost)
    pkg_cost = to_decimal(packaging_cost)
    oth_cost = to_decimal(other_cost)
    cost_basis = (mat_cost + lab_cost + pkg_cost + oth_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    has_costs = cost_basis > 0

    margin_pct = to_decimal(min_margin_pct, "0.20")
    if has_costs:
        minimum_fair_price = (cost_basis * (Decimal("1.0") + margin_pct)).quantize(Decimal("1.00"), rounding=ROUND_HALF_UP)
    else:
        minimum_fair_price = Decimal("0.00")

    curr_price = to_decimal(current_price)
    has_artisan_price = curr_price > 0
    prod_curr = str(product_currency or "INR").strip()

    # Determine market median signal and range
    market_anchor, market_signal_used, market_status = compute_market_median_signal(
        base_anchor=curr_price if has_artisan_price else minimum_fair_price,
        market_median=market_median,
        minimum_fair_price=minimum_fair_price if has_costs else None,
        product_currency=prod_curr,
        market_currency=market_currency
    )

    med_dec = to_decimal(market_median) if (market_signal_used and market_median is not None) else None
    low_dec = to_decimal(benchmark_low) if benchmark_low is not None and to_decimal(benchmark_low) > 0 else None
    high_dec = to_decimal(benchmark_high) if benchmark_high is not None and to_decimal(benchmark_high) > 0 else None
    market_adj, market_pos = compute_market_adjustment(float(curr_price), benchmark_low, benchmark_high)

    reasoning: List[str] = []

    # -------------------------------------------------------------------------
    # PRICING ENGINE DECISION TREE IMPLEMENTATION
    # -------------------------------------------------------------------------
    if not has_artisan_price:
        # Case 1 — Price NOT provided by Artisan
        pricing_case = "CASE_1_PRICE_NOT_PROVIDED"
        if med_dec is not None and med_dec > 0:
            raw_recommended = med_dec
            reasoning.append(f"Selling price not provided. Recommended fair market price based on comparable market median (₹{float(med_dec):,.0f}).")
        elif low_dec is not None and high_dec is not None:
            raw_recommended = (low_dec + high_dec) / Decimal("2.0")
            reasoning.append(f"Selling price not provided. Recommended mid-range price based on craft benchmarks (₹{float(raw_recommended):,.0f}).")
        elif has_costs and minimum_fair_price > 0:
            raw_recommended = minimum_fair_price
            reasoning.append(f"Selling price not provided. Recommendation set to minimum fair price (₹{float(minimum_fair_price):,.0f}) based on cost basis.")
        else:
            raw_recommended = None
            reasoning.append("Selling price not provided and no market research or cost inputs available.")

    else:
        # Artisan provided a price (curr_price > 0)
        is_below = False
        is_above = False
        is_inside = False

        if med_dec is not None and med_dec > 0:
            if curr_price < (med_dec * Decimal("0.85")):
                is_below = True
            elif curr_price > (med_dec * Decimal("1.15")):
                is_above = True
            else:
                is_inside = True
        elif low_dec is not None and high_dec is not None:
            if curr_price < low_dec:
                is_below = True
            elif curr_price > high_dec:
                is_above = True
            else:
                is_inside = True
        else:
            is_inside = True

        if is_below:
            # Case 2 — Artisan price below market range -> move to market median!
            pricing_case = "CASE_2_BELOW_MARKET"
            target_mkt = med_dec or low_dec or curr_price
            raw_recommended = target_mkt
            reasoning.append(f"Your price (₹{float(curr_price):,.0f}) is below observed market range (median ₹{float(target_mkt):,.0f}). We suggest adjusting toward market fair value.")

        elif is_above:
            # Case 4 — Artisan price above market range -> preserve artisan price & flag premium!
            pricing_case = "CASE_4_ABOVE_MARKET"
            raw_recommended = curr_price
            mkt_ref_str = f"₹{float(med_dec):,.0f}" if med_dec else f"₹{float(high_dec):,.0f}"
            reasoning.append(f"Your price (₹{float(curr_price):,.0f}) is above the observed market range (median {mkt_ref_str}). Premium handcrafted positioning flagged.")

        else:
            # Case 3 — Artisan price inside market range -> preserve artisan price exactly!
            pricing_case = "CASE_3_INSIDE_MARKET"
            raw_recommended = curr_price
            reasoning.append(f"Your price (₹{float(curr_price):,.0f}) is inside the competitive market range. Preserving your price.")

    # -------------------------------------------------------------------------
    # COST FLOOR ENFORCEMENT & FINAL PRICE CALCULATION
    # -------------------------------------------------------------------------
    if raw_recommended is not None:
        if has_costs and minimum_fair_price > 0:
            final_recommended = max(raw_recommended, minimum_fair_price)
            if final_recommended > raw_recommended:
                reasoning.append(f"Protected minimum fair price floor applied (₹{float(minimum_fair_price):,.0f}) to guarantee your configured {int(float(margin_pct) * 100)}% profit margin above cost basis.")
        else:
            final_recommended = raw_recommended

        rounded_price = (Decimal(round(float(final_recommended) / 5.0) * 5)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if has_costs and rounded_price < minimum_fair_price:
            rounded_price = minimum_fair_price
        pricing_available = True
    else:
        if has_costs and minimum_fair_price > 0:
            final_recommended = minimum_fair_price
            rounded_price = (Decimal(round(float(final_recommended) / 5.0) * 5)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            pricing_available = True
        else:
            final_recommended = None
            rounded_price = None
            pricing_available = False

    if curr_price > 0 and rounded_price is not None:
        price_change_amount = (rounded_price - curr_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        price_change_pct = round((float(price_change_amount) / float(curr_price) * 100.0), 1)
    else:
        price_change_amount = Decimal("0.00")
        price_change_pct = 0.0

    if demand_pct > 0 or demand_label:
        reasoning.append(f"{category} market demand indicates {demand_pct}% share ({demand_label}, factor {float(demand_factor):.3f}x).")

    if ml_info and ml_info.get("model_source") == "TRAINED_ML_MODEL":
        r2_score = ml_info.get("model_info", {}).get("r2_score")
        r2_suffix = f" (R² = {r2_score})" if r2_score is not None else ""
        ml_score = ml_info.get("predicted_demand_score", 0.0)
        ml_level = ml_info.get("demand_level", "NORMAL")
        ml_multiplier = ml_info.get("ml_demand_multiplier", 1.0)
        reasoning.append(f"RandomForestRegressor ML Demand Engine predicted score {int(ml_score)}/100 ({ml_level} DEMAND, factor {ml_multiplier:.2f}x){r2_suffix} from dataset training metrics.")

    if has_costs:
        cost_breakdown = f"Material: ₹{float(mat_cost):,.0f}, Labour: ₹{float(lab_cost):,.0f}, Packaging: ₹{float(pkg_cost):,.0f}"
        if oth_cost > 0:
            cost_breakdown += f", Other: ₹{float(oth_cost):,.0f}"
        reasoning.append(f"Cost basis is ₹{float(cost_basis):,.0f} ({cost_breakdown}).")

    if market_signal_used and med_dec is not None:
        reasoning.append(f"Comparable market median is ₹{float(med_dec):,.0f} based on live market research.")
    elif market_status == "CURRENCY_MISMATCH":
        reasoning.append("Market research currency does not match product currency; ignoring market signal.")

    safety_constraints = {
        "minimum_fair_price_protected": has_costs,
        "pricing_case": pricing_case,
        "premium_positioning": pricing_case == "CASE_4_ABOVE_MARKET",
        "min_margin_percentage": int(float(margin_pct) * 100) if has_costs else 0,
        "seller_approval_mandatory": not auto_smart_pricing_enabled,
        "autonomous_mode_enabled": auto_smart_pricing_enabled,
        "pricing_mode": "AUTONOMOUS_AUTO_APPLY" if auto_smart_pricing_enabled else "SELLER_APPROVAL_RECOMMENDATION"
    }

    return {
        "product_id": product_id,
        "product_title": title,
        "category": category,
        "current_price": float(curr_price),
        "cost_basis": float(cost_basis),
        "minimum_fair_price": float(minimum_fair_price),
        "demand_factor": float(demand_factor),
        "market_adjustment": float(market_adj),
        "recommended_price": float(rounded_price) if rounded_price is not None else None,
        "pricing_available": pricing_available,
        "market_median": float(med_dec) if med_dec is not None else None,
        "market_weight": float(CONFIG_MARKET_MEDIAN_WEIGHT) if market_signal_used else 0.0,
        "market_signal_used": market_signal_used,
        "market_range": {
            "low": float(low_dec) if low_dec is not None else 0.0,
            "high": float(high_dec) if high_dec is not None else 0.0
        },
        "current_market_position": market_pos,
        "price_change_amount": float(price_change_amount),
        "price_change_percentage": price_change_pct,
        "reasoning": reasoning,
        "safety_constraints": safety_constraints
    }

def calculate_price_recommendation(
    product: Product,
    db: Session,
    market_median: Optional[Any] = None,
    market_currency: Optional[str] = None
) -> Dict[str, Any]:
    """
    Deterministic explainable dynamic pricing calculation for a Product database model.
    Queries database for category demand & ML metrics, then delegates to pure calculate_price_recommendation_from_inputs.
    """
    all_demands = {d["category"]: d for d in calculate_category_demand(db)}
    cat_demand = all_demands.get(product.category)
    
    if cat_demand:
        demand_pct = float(cat_demand["demand_pct"])
        benchmark_low = to_decimal(cat_demand["benchmark_min"]) if cat_demand["benchmark_min"] is not None else None
        benchmark_high = to_decimal(cat_demand["benchmark_max"]) if cat_demand["benchmark_max"] is not None else None
    else:
        demand_pct = 0.0
        benchmark_low = None
        benchmark_high = None

    demand_factor, demand_label = compute_demand_factor(demand_pct)

    from backend.app.services.ml_demand_engine import predict_product_demand
    ml_pred = predict_product_demand(product, db)
    ml_multiplier = ml_pred.get("ml_demand_multiplier", 1.00)
    model_src = ml_pred.get("model_source", "RULE_BASED_FALLBACK")

    if model_src == "TRAINED_ML_MODEL":
        demand_factor = max(demand_factor, float(ml_multiplier))
        demand_factor = max(MIN_DEMAND_FACTOR, min(MAX_DEMAND_FACTOR, round(demand_factor, 3)))

    save_count = db.query(Event).filter(Event.product_id == product.id, Event.event_type == "SAVE").count()
    enquiry_count = db.query(Event).filter(Event.product_id == product.id, Event.event_type == "ENQUIRY").count()

    rec = calculate_price_recommendation_from_inputs(
        title=product.title,
        category=product.category,
        current_price=product.price,
        material_cost=getattr(product, "material_cost", 0.0),
        labour_cost=getattr(product, "labour_cost", 0.0),
        packaging_cost=getattr(product, "packaging_cost", 0.0),
        other_cost=getattr(product, "other_cost", 0.0),
        min_margin_pct=getattr(product, "min_margin_pct", 0.20),
        market_median=market_median,
        market_currency=market_currency,
        product_currency=getattr(product, "currency", None) or "INR",
        demand_pct=demand_pct,
        demand_factor=demand_factor,
        demand_label=demand_label,
        benchmark_low=benchmark_low,
        benchmark_high=benchmark_high,
        save_count=save_count,
        enquiry_count=enquiry_count,
        auto_smart_pricing_enabled=bool(getattr(product, "auto_smart_pricing_enabled", False)),
        product_id=product.id,
        ml_info=ml_pred
    )

    curr_price = to_decimal(product.price)
    last_applied = (
        db.query(PricingDecision)
        .filter(
            PricingDecision.product_id == product.id,
            PricingDecision.decision.in_(["ACCEPT", "AUTO_APPLIED"])
        )
        .order_by(PricingDecision.timestamp.desc())
        .first()
    )
    if last_applied is not None and to_decimal(last_applied.applied_price) == curr_price:
        new_prod_events = db.query(Event).filter(Event.product_id == product.id, Event.timestamp > last_applied.timestamp).count()
        new_cat_events = db.query(Event).filter(Event.category == product.category, Event.timestamp > last_applied.timestamp).count()
        if new_prod_events == 0 and new_cat_events < 5:
            rec["recommended_price"] = float(curr_price)
            rec["price_change_amount"] = 0.0
            rec["price_change_percentage"] = 0.0

    return rec

def process_auto_smart_pricing(
    product: Product,
    db: Session,
    cooldown_minutes: int = 15,
    bypass_cooldown: bool = False,
    market_median: Optional[Any] = None,
    market_currency: Optional[str] = None
) -> Optional[PricingDecision]:
    """
    Autonomous Dynamic Pricing Execution.
    If product.auto_smart_pricing_enabled is True:
    - Checks 15-minute cooldown to prevent excessive DB writes from event spams.
    - Calculates current price recommendation.
    - If recommended price differs from current price:
      1. Automatically updates product.price = recommended_price.
      2. Creates a PricingDecision audit record with decision="AUTO_APPLIED".
      3. Returns the decision record.
    """
    import json
    from datetime import datetime, timezone

    if not getattr(product, "auto_smart_pricing_enabled", False):
        return None

    # Cooldown Guard: Skip automatic repricing if evaluated within last cooldown_minutes
    if not bypass_cooldown:
        last_decision = (
            db.query(PricingDecision)
            .filter(PricingDecision.product_id == product.id)
            .order_by(PricingDecision.timestamp.desc())
            .first()
        )
        if last_decision is not None and cast(Any, last_decision.timestamp) is not None:
            now_utc = datetime.now(timezone.utc)
            ts = last_decision.timestamp
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            elapsed_minutes = (now_utc - ts).total_seconds() / 60.0
            if elapsed_minutes < cooldown_minutes:
                return None

    rec = calculate_price_recommendation(
        product, db, market_median=market_median, market_currency=market_currency
    )
    prev_price = Decimal(str(product.price)).quantize(Decimal("0.01"))
    rec_price = Decimal(str(rec["recommended_price"])).quantize(Decimal("0.01"))

    # Only apply if there is an actual price change recommendation
    if prev_price == rec_price:
        return None

    # Apply price change automatically
    setattr(product, "price", rec_price)

    decision_record = PricingDecision(
        product_id=product.id,
        decision="AUTO_APPLIED",
        previous_price=prev_price,
        recommended_price=rec_price,
        applied_price=rec_price,
        demand_factor=Decimal(str(rec["demand_factor"])).quantize(Decimal("0.0001")),
        market_adjustment=Decimal(str(rec["market_adjustment"])).quantize(Decimal("0.0001")),
        reasoning_json=json.dumps(rec["reasoning"]),
        timestamp=datetime.now(timezone.utc)
    )
    db.add(decision_record)
    db.commit()
    db.refresh(decision_record)
    db.refresh(product)
    return decision_record

def trigger_auto_pricing(
    product_or_id: Any,
    db: Session,
    bypass_cooldown: bool = False,
    market_median: Optional[Any] = None,
    market_currency: Optional[str] = None
) -> Optional[PricingDecision]:
    """
    Centralized helper to trigger autonomous smart pricing evaluation for a product
    after any meaningful buyer demand signal (VIEW, SAVE, ENQUIRY, ORDER).
    If auto_smart_pricing_enabled is True, evaluates demand and updates product price in DB.
    """
    if product_or_id is None:
        return None
    if isinstance(product_or_id, (int, str)) and str(product_or_id).isdigit():
        product = db.query(Product).filter(Product.id == int(product_or_id)).first()
    else:
        product = product_or_id

    if not product or not getattr(product, "auto_smart_pricing_enabled", False):
        return None

    return process_auto_smart_pricing(
        product,
        db,
        bypass_cooldown=bypass_cooldown,
        market_median=market_median,
        market_currency=market_currency
    )
