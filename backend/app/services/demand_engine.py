from typing import Dict, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models import Event, Product, User

# Baseline market indices per heritage craft category
BASELINE_MARKET_DEMAND = {
    "Kalamkari": {"base_pct": 28, "benchmark_min": 1150, "benchmark_max": 1400},
    "Wooden Toys": {"base_pct": 20, "benchmark_min": 750, "benchmark_max": 1000},
    "Blue Pottery": {"base_pct": 16, "benchmark_min": 1400, "benchmark_max": 1800},
    "Bidriware": {"base_pct": 14, "benchmark_min": 1900, "benchmark_max": 2400},
    "Pochampally Ikat": {"base_pct": 22, "benchmark_min": 1000, "benchmark_max": 1350},
    "Handloom": {"base_pct": 15, "benchmark_min": 900, "benchmark_max": 1250},
}

EVENT_WEIGHTS = {
    "SEARCH": 2,
    "VIEW": 1,
    "SAVE": 4,
    "ENQUIRY": 6,
    "ORDER": 10
}

def calculate_category_demand(db: Session) -> List[Dict[str, Any]]:
    """
    Computes real-time dynamic demand scores for each craft category
    based on aggregated events stored in the SQLite database.
    """
    results = (
        db.query(Event.category, Event.event_type, func.count(Event.id))
        .filter(Event.category.isnot(None))
        .group_by(Event.category, Event.event_type)
        .all()
    )

    event_counts: Dict[str, Dict[str, int]] = {}
    for cat, ev_type, count in results:
        if cat not in event_counts:
            event_counts[cat] = {}
        event_counts[cat][ev_type] = count

    demand_list = []
    for cat, baseline in BASELINE_MARKET_DEMAND.items():
        counts = event_counts.get(cat, {})
        weighted_score = sum(counts.get(ev, 0) * weight for ev, weight in EVENT_WEIGHTS.items())
        total_events = sum(counts.values())

        # Dynamic surge: each weighted interaction dynamically increases demand up to 98%
        dynamic_surge = min(70, weighted_score * 2)
        calculated_pct = baseline["base_pct"] + dynamic_surge

        level = "HIGH" if calculated_pct >= 30 else ("MODERATE" if calculated_pct >= 20 else "NORMAL")
        trend = "INCREASING" if dynamic_surge > 0 else "STABLE"

        demand_list.append({
            "category": cat,
            "demand_pct": calculated_pct,
            "demand_pct_label": f"+{calculated_pct}%",
            "demand_level": level,
            "trend_direction": trend,
            "benchmark_price_range": f"₹{baseline['benchmark_min']}–₹{baseline['benchmark_max']}",
            "benchmark_min": baseline["benchmark_min"],
            "benchmark_max": baseline["benchmark_max"],
            "total_buyer_events": total_events,
            "event_breakdown": counts
        })

    demand_list.sort(key=lambda x: x["demand_pct"], reverse=True)
    return demand_list

def generate_seller_opportunities(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Generates actionable seller opportunities and AI Business Copilot guidance
    connected directly to the Pricing Engine and real-time category demand.
    """
    # Import here to prevent circular import
    from backend.app.services.pricing_engine import calculate_price_recommendation

    category_demands = {d["category"]: d for d in calculate_category_demand(db)}
    seller_products = db.query(Product).filter(Product.seller_id == user_id).all()
    
    if not seller_products:
        seller_products = db.query(Product).all()

    opportunities = []
    copilot_insight = None

    for prod in seller_products:
        cat_demand = category_demands.get(prod.category)
        if not cat_demand:
            continue

        pricing_rec = calculate_price_recommendation(prod, db)
        rec_price = pricing_rec["recommended_price"]

        save_count = db.query(Event).filter(Event.product_id == prod.id, Event.event_type == "SAVE").count()
        enquiry_count = db.query(Event).filter(Event.product_id == prod.id, Event.event_type == "ENQUIRY").count()

        is_high_demand = cat_demand["demand_pct"] >= 25
        is_low_inventory = prod.stock <= 8

        if is_high_demand:
            action_text = f"Review price: ₹{int(prod.price)} → ₹{int(rec_price)}. Consider producing 10–15 more units."

            opp = {
                "product_id": prod.id,
                "product_title": prod.title,
                "category": prod.category,
                "demand_pct": cat_demand["demand_pct"],
                "demand_label": cat_demand["demand_pct_label"],
                "stock": prod.stock,
                "buyer_saves": save_count,
                "buyer_enquiries": enquiry_count,
                "current_price": prod.price,
                "recommended_price": rec_price,
                "minimum_fair_price": pricing_rec["minimum_fair_price"],
                "benchmark_range": cat_demand["benchmark_price_range"],
                "headline": f"{prod.category} demand is increasing",
                "narrative": (
                    f"{prod.category} demand is increasing (+{cat_demand['demand_pct']}%). "
                    f"Your current price is ₹{int(prod.price):,}. Based on your protected margin (≥{int(pricing_rec['safety_constraints']['min_margin_percentage'])}%), "
                    f"demand signals, and comparable products ({cat_demand['benchmark_price_range']}), "
                    f"the recommended price is ₹{int(rec_price):,}. "
                    f"Review the full price explanation before making a decision. Your price will not change automatically."
                ),
                "next_best_action": action_text,
                "urgency": "HIGH" if is_low_inventory else "MEDIUM"
            }
            opportunities.append(opp)

            if not copilot_insight or opp["demand_pct"] > copilot_insight["demand_pct"]:
                copilot_insight = opp

    if not copilot_insight and category_demands:
        top_cat = list(category_demands.values())[0]
        copilot_insight = {
            "product_id": None,
            "product_title": "Artisan Catalog",
            "category": top_cat["category"],
            "demand_pct": top_cat["demand_pct"],
            "demand_label": top_cat["demand_pct_label"],
            "stock": sum(p.stock for p in seller_products),
            "buyer_saves": 0,
            "buyer_enquiries": 0,
            "benchmark_range": top_cat["benchmark_price_range"],
            "headline": f"{top_cat['category']} demand is increasing",
            "narrative": f"Market search trends show growing interest in {top_cat['category']} crafts (+{top_cat['demand_pct']}%). Prepare your authentic listings.",
            "next_best_action": f"Expand your {top_cat['category']} collection.",
            "urgency": "MEDIUM"
        }

    return {
        "copilot_insight": copilot_insight,
        "opportunities": opportunities,
        "category_demand": list(category_demands.values())
    }
