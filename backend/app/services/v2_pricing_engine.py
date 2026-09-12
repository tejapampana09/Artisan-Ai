import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional
from backend.app.services.pricing_engine import to_decimal

logger = logging.getLogger("artisan_ai")

MAX_UPWARD_ADJUSTMENT_PCT = Decimal("0.25")
MAX_DOWNWARD_ADJUSTMENT_PCT = Decimal("0.10")

def to_decimal_str(val) -> Optional[str]:
    if val is None:
        return None
    try:
        return str(Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    except Exception:
        return None

class V2PricingEngine:
    """
    Deterministic explainable dynamic pricing engine for Artisan AI V2.
    Integrates Market Evidence + Cost Floor + Artisan Expected Price + Safety Caps.
    Produces an explicit, auditable response schema.
    """
    def calculate_v2_recommendation(
        self,
        material_cost: Optional[Any] = None,
        labour_cost: Optional[Any] = None,
        packaging_cost: Optional[Any] = None,
        other_cost: Optional[Any] = None,
        min_margin_pct: Optional[Any] = None,
        market_research_result: Optional[Dict[str, Any]] = None,
        artisan_expected_price: Optional[Any] = None,
        current_price: Optional[Any] = None,
        ml_demand_multiplier: Optional[Any] = None,
        ml_demand_info: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        # 1. Cost Floor Availability & Calculation
        has_cost_inputs = any(
            c is not None and Decimal(str(c)) > 0 
            for c in [material_cost, labour_cost, packaging_cost, other_cost]
        )
        
        mat = to_decimal(material_cost)
        lab = to_decimal(labour_cost)
        pkg = to_decimal(packaging_cost)
        oth = to_decimal(other_cost)
        cost_basis = (mat + lab + pkg + oth).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        margin_pct = to_decimal(min_margin_pct or Decimal("0.20"), "0.20")

        warnings: List[str] = []
        pricing_factors: List[str] = []

        if has_cost_inputs and cost_basis > Decimal("0.00"):
            cost_floor_available = True
            minimum_fair_price = (cost_basis * (Decimal("1.0") + margin_pct)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            pricing_factors.append("Fair-cost floor protection")
        else:
            cost_floor_available = False
            minimum_fair_price = Decimal("100.00")
            warnings.append("Cost-based floor unavailable — cost details not provided")

        # 2. Market Evidence Context
        market_res = market_research_result or {}
        m_range = market_res.get("market_range", {})
        m_low = to_decimal(m_range.get("min") or m_range.get("low")) if (m_range.get("min") or m_range.get("low")) is not None else None
        m_high = to_decimal(m_range.get("max") or m_range.get("high")) if (m_range.get("max") or m_range.get("high")) is not None else None
        m_median = to_decimal(market_res.get("median")) if market_res.get("median") is not None else None

        if m_median is not None:
            pricing_factors.append("Market reference data")

        # 3. Artisan Expected Price
        exp_price = to_decimal(artisan_expected_price) if artisan_expected_price is not None and Decimal(str(artisan_expected_price)) > 0 else None
        if exp_price is not None:
            pricing_factors.append("Artisan expected price")

        # 4. Target Calculation
        if exp_price is not None and m_median is not None:
            raw_target = (exp_price * Decimal("0.40") + m_median * Decimal("0.60")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        elif exp_price is not None:
            raw_target = exp_price
        elif m_median is not None:
            raw_target = m_median
        else:
            raw_target = minimum_fair_price * Decimal("1.25")

        # 4b. Integrate ML Demand Signal (RandomForest Model Inference)
        bounded_ml: Optional[Decimal] = None
        if ml_demand_multiplier is not None:
            bounded_ml = min(Decimal("1.15"), max(Decimal("0.95"), Decimal(str(ml_demand_multiplier))))
            raw_target = (raw_target * bounded_ml).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            pricing_factors.append("ML Demand Signal")

        curr_price = to_decimal(current_price) if current_price is not None and Decimal(str(current_price)) > 0 else minimum_fair_price

        # 5. Apply Safety Caps (+25% upper limit / -10% lower limit)
        if curr_price > 0:
            max_upward_allowed = (curr_price * (Decimal("1.0") + MAX_UPWARD_ADJUSTMENT_PCT)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            min_downward_allowed = (curr_price * (Decimal("1.0") - MAX_DOWNWARD_ADJUSTMENT_PCT)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            if curr_price < minimum_fair_price and cost_floor_available:
                final_rec = min(max_upward_allowed, minimum_fair_price)
            else:
                bounded = min(max_upward_allowed, max(min_downward_allowed, raw_target))
                final_rec = max(bounded, minimum_fair_price)
        else:
            max_upward_allowed = minimum_fair_price
            final_rec = max(raw_target, minimum_fair_price)

        # Round to nearest ₹5
        rounded_price = (Decimal(round(float(final_rec) / 5.0) * 5)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if curr_price > 0 and rounded_price > max_upward_allowed:
            rounded_price = max_upward_allowed
            pricing_factors.append("Safety upper limit (+25% cap)")
        if curr_price >= minimum_fair_price and rounded_price < minimum_fair_price:
            rounded_price = minimum_fair_price

        # Bulleted Reasoning List
        reasoning: List[str] = []
        if m_median is not None:
            reasoning.append(f"Comparable craft market evidence indicates median ₹{int(m_median):,}.")
        if exp_price is not None:
            reasoning.append(f"Your stated expected selling price is ₹{int(exp_price):,}.")
        if cost_floor_available:
            reasoning.append(f"Cost basis is ₹{int(cost_basis):,} with protected profit margin (Minimum fair price ₹{int(minimum_fair_price):,}).")
        else:
            reasoning.append("Cost floor details not specified.")

        if bounded_ml is not None:
            if ml_demand_info and ml_demand_info.get("model_source") == "TRAINED_ML_MODEL":
                lvl = ml_demand_info.get("demand_level", "NORMAL")
                score = ml_demand_info.get("predicted_demand_score", 0)
                reasoning.append(f"ML Demand Model evaluates {lvl} market interest (score {score}/100, {float(bounded_ml):.2f}x multiplier).")
            else:
                reasoning.append(f"ML demand signal factored at {float(bounded_ml):.2f}x multiplier.")

        return {
            "recommended_price": to_decimal_str(rounded_price),
            "cost_floor_available": cost_floor_available,
            "cost_floor": to_decimal_str(minimum_fair_price) if cost_floor_available else None,
            "market_reference": to_decimal_str(m_median) if m_median is not None else None,
            "artisan_expected_price": to_decimal_str(exp_price) if exp_price is not None else None,
            "cost_basis": to_decimal_str(cost_basis),
            "minimum_fair_price": to_decimal_str(minimum_fair_price),
            "market_range": {
                "low": to_decimal_str(m_low),
                "high": to_decimal_str(m_high)
            },
            "market_median": to_decimal_str(m_median),
            "ml_demand_multiplier": float(bounded_ml) if bounded_ml is not None else 1.0,
            "pricing_factors": pricing_factors,
            "warnings": warnings,
            "reasoning": reasoning,
            "safety_constraints": {
                "minimum_fair_price_protected": cost_floor_available,
                "max_upward_cap_applied": rounded_price >= max_upward_allowed if curr_price > 0 else False,
                "max_upward_cap_pct": "+25%",
                "pricing_mode": "ARTISAN_REVIEW_RECOMMENDATION"
            }
        }
