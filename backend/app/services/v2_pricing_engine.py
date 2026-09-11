import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional
from backend.app.services.pricing_engine import to_decimal

logger = logging.getLogger("artisan_ai")

MAX_UPWARD_ADJUSTMENT_PCT = Decimal("0.25")
MAX_DOWNWARD_ADJUSTMENT_PCT = Decimal("0.10")

class V2PricingEngine:
    """
    Deterministic explainable dynamic pricing engine for Artisan AI V2.
    Integrates Market Evidence + Cost Floor + Artisan Expected Price + Demand Signals + Safety Caps.
    """
    def calculate_v2_recommendation(
        self,
        db: Session,
        category: str,
        material_cost: Optional[Any] = None,
        labour_cost: Optional[Any] = None,
        packaging_cost: Optional[Any] = None,
        other_cost: Optional[Any] = None,
        min_margin_pct: Optional[Any] = None,
        market_research_result: Optional[Dict[str, Any]] = None,
        artisan_expected_price: Optional[Any] = None,
        current_price: Optional[Any] = None
    ) -> Dict[str, Any]:
        # 1. Cost Basis & Minimum Fair Price (Decimal arithmetic)
        mat = to_decimal(material_cost)
        lab = to_decimal(labour_cost)
        pkg = to_decimal(packaging_cost)
        oth = to_decimal(other_cost)
        cost_basis = (mat + lab + pkg + oth).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        
        margin_pct = to_decimal(min_margin_pct or Decimal("0.20"), "0.20")
        minimum_fair_price = (cost_basis * (Decimal("1.0") + margin_pct)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if minimum_fair_price <= Decimal("0.00"):
            minimum_fair_price = Decimal("100.00") # Default baseline floor if zero costs specified

        # 2. Market Evidence Context
        market_res = market_research_result or {}
        m_range = market_res.get("market_range", {})
        m_low = to_decimal(m_range.get("low")) if m_range.get("low") is not None else None
        m_high = to_decimal(m_range.get("high")) if m_range.get("high") is not None else None
        m_median = to_decimal(market_res.get("median")) if market_res.get("median") is not None else None

        # 3. Artisan Expected Price
        exp_price = to_decimal(artisan_expected_price) if artisan_expected_price is not None and Decimal(str(artisan_expected_price)) > 0 else None

        # 4. Raw Anchor Calculation
        if exp_price is not None and m_median is not None:
            # Weighted average between Artisan Expected Price (40%) and Market Evidence Median (60%)
            raw_target = (exp_price * Decimal("0.40") + m_median * Decimal("0.60")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        elif exp_price is not None:
            raw_target = exp_price
        elif m_median is not None:
            raw_target = m_median
        else:
            raw_target = minimum_fair_price * Decimal("1.25")

        curr_price = to_decimal(current_price) if current_price is not None and Decimal(str(current_price)) > 0 else minimum_fair_price

        # 5. Apply Safety Caps (Option B: Absolute +25% single-cycle cap)
        if curr_price > 0:
            max_upward_allowed = (curr_price * (Decimal("1.0") + MAX_UPWARD_ADJUSTMENT_PCT)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            min_downward_allowed = (curr_price * (Decimal("1.0") - MAX_DOWNWARD_ADJUSTMENT_PCT)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            if curr_price < minimum_fair_price:
                # Progress gradually towards minimum fair floor
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
        if curr_price >= minimum_fair_price and rounded_price < minimum_fair_price:
            rounded_price = minimum_fair_price

        # 6. Transparent Bulleted Reasoning List
        reasoning: List[str] = []
        if m_low is not None and m_high is not None:
            reasoning.append(f"Comparable craft market evidence indicates ₹{int(m_low):,}–₹{int(m_high):,} (Median ₹{int(m_median):,}).")
        if exp_price is not None:
            reasoning.append(f"Your stated expected selling price is ₹{int(exp_price):,}.")
        
        if cost_basis > 0:
            reasoning.append(f"Cost basis is ₹{float(cost_basis):,.0f} with protected {int(float(margin_pct)*100)}% profit margin (Minimum fair price ₹{int(minimum_fair_price):,}).")
        else:
            reasoning.append(f"Protected minimum fair price floor is ₹{int(minimum_fair_price):,}.")

        if curr_price > 0 and curr_price < minimum_fair_price:
            reasoning.append(f"Current price is below cost floor. Upward recommendation is capped at +25% (₹{float(rounded_price):,.0f}) to progress gradually towards cost floor.")
        elif rounded_price >= max_upward_allowed and curr_price > 0 and rounded_price > curr_price:
            reasoning.append(f"Maximum +25% single-cycle upward safety cap applied (₹{float(rounded_price):,.0f}).")
        else:
            reasoning.append("Recommended price balances market evidence, artisan expectation, and profit margin safety.")

        return {
            "recommended_price": float(rounded_price),
            "cost_basis": float(cost_basis),
            "minimum_fair_price": float(minimum_fair_price),
            "artisan_expected_price": float(exp_price) if exp_price is not None else None,
            "market_range": {
                "low": float(m_low) if m_low is not None else 0.0,
                "high": float(m_high) if m_high is not None else 0.0
            },
            "market_median": float(m_median) if m_median is not None else 0.0,
            "reasoning": reasoning,
            "safety_constraints": {
                "minimum_fair_price_protected": True,
                "max_upward_cap_applied": rounded_price >= max_upward_allowed if curr_price > 0 else False,
                "max_upward_cap_pct": "+25%",
                "pricing_mode": "ARTISAN_REVIEW_RECOMMENDATION"
            }
        }
