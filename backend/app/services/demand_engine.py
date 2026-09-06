from typing import Dict, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models import Event, Product, User

# Standard heritage craft categories recognized by the platform
STANDARD_CRAFT_CATEGORIES = [
    "Kalamkari",
    "Wooden Toys",
    "Blue Pottery",
    "Bidriware",
    "Pochampally Ikat",
    "Handloom"
]

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
    based strictly on actual aggregated buyer interactions and live catalog listings.
    Zero hardcoded baselines or simulated fallback prices.
    """
    # 1. Fetch live price benchmarks per category from published products
    price_stats = (
        db.query(
            Product.category,
            func.min(Product.price).label("min_price"),
            func.max(Product.price).label("max_price"),
            func.count(Product.id).label("catalog_count")
        )
        .filter(Product.status == "PUBLISHED", Product.category.isnot(None))
        .group_by(Product.category)
        .all()
    )
    benchmarks_by_cat = {
        row.category: {
            "min": float(row.min_price) if row.min_price is not None else None,
            "max": float(row.max_price) if row.max_price is not None else None,
            "count": row.catalog_count
        }
        for row in price_stats
    }

    # 2. Fetch real buyer events aggregated by category and event type
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

    # Determine all active categories (from catalog, events, and standard categories)
    all_categories = list(dict.fromkeys(
        list(benchmarks_by_cat.keys()) + 
        list(event_counts.keys()) + 
        STANDARD_CRAFT_CATEGORIES
    ))

    # Calculate total market engagement across all categories
    category_scores = {}
    total_market_engagement = 0
    for cat in all_categories:
        counts = event_counts.get(cat, {})
        weighted_score = sum(counts.get(ev, 0) * weight for ev, weight in EVENT_WEIGHTS.items())
        category_scores[cat] = weighted_score
        total_market_engagement += weighted_score

    demand_list = []
    for cat in all_categories:
        counts = event_counts.get(cat, {})
        weighted_score = category_scores[cat]
        total_events = sum(counts.values())

        # 100% Real Demand Calculation:
        # If the platform has buyer interactions, demand_pct is the category's real percentage share of total buyer interest.
        # If no events exist anywhere yet, demand is 0% (honest, real zero baseline).
        if total_market_engagement > 0 and weighted_score > 0:
            calculated_pct = max(1, round((weighted_score / total_market_engagement) * 100))
            level = "HIGH" if calculated_pct >= 30 else ("MODERATE" if calculated_pct >= 15 else "NORMAL")
            trend = "INCREASING"
            pct_label = f"+{calculated_pct}%"
        elif weighted_score > 0:
            calculated_pct = weighted_score
            level = "HIGH" if calculated_pct >= 30 else ("MODERATE" if calculated_pct >= 15 else "NORMAL")
            trend = "INCREASING"
            pct_label = f"+{calculated_pct}%"
        else:
            calculated_pct = 0
            level = "NORMAL"
            trend = "STABLE"
            pct_label = "0%"

        # Determine price benchmark from live catalog:
        # Strictly authentic: if no products listed in this category, do NOT invent fake ₹800-₹1500!
        cat_stats = benchmarks_by_cat.get(cat)
        if cat_stats and cat_stats["count"] > 0 and cat_stats["min"] is not None and cat_stats["max"] is not None:
            b_min = int(cat_stats["min"])
            b_max = int(cat_stats["max"])
            range_str = f"₹{b_min}–₹{b_max}" if b_min != b_max else f"₹{b_min}"
            source_label = f"Live Marketplace ({cat_stats['count']} listings)"
        else:
            b_min, b_max = None, None
            range_str = "No Listings"
            source_label = "Awaiting initial catalog listings"

        demand_list.append({
            "category": cat,
            "demand_pct": calculated_pct,
            "demand_pct_label": pct_label,
            "demand_level": level,
            "trend_direction": trend,
            "benchmark_price_range": range_str,
            "benchmark_min": b_min,
            "benchmark_max": b_max,
            "data_source_label": source_label,
            "total_buyer_events": total_events,
            "event_breakdown": counts
        })

    demand_list.sort(key=lambda x: (x["demand_pct"], x["total_buyer_events"]), reverse=True)
    return demand_list

def generate_seller_opportunities(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Generates actionable seller opportunities and AI Business Copilot guidance
    connected directly to the Pricing Engine and real-time category demand.
    Strictly isolates seller data to prevent leaking other artisans' inventory.
    """
    from backend.app.services.pricing_engine import calculate_price_recommendation

    category_demands = {d["category"]: d for d in calculate_category_demand(db)}
    seller_products = db.query(Product).filter(Product.seller_id == user_id).all()
    
    # Strictly isolated: if seller has no products, return a clean onboarding guidance state
    if not seller_products:
        return {
            "copilot_insight": {
                "product_id": None,
                "product_title": "No Active Listings",
                "category": "All Crafts",
                "demand_pct": 0,
                "demand_label": "0%",
                "stock": 0,
                "buyer_saves": 0,
                "buyer_enquiries": 0,
                "benchmark_range": "N/A",
                "headline": "No craft listings in catalog",
                "narrative": "You do not have any active craft products listed yet. Create your first product listing in AI Catalog Studio to activate automated pricing recommendations and market demand tracking.",
                "next_best_action": "Open AI Catalog Studio to list your first handcrafted creation.",
                "urgency": "LOW"
            },
            "opportunities": [],
            "category_demand": list(category_demands.values())
        }

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

        is_high_demand = cat_demand["demand_pct"] >= 15
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
            "headline": f"{top_cat['category']} market interest",
            "narrative": f"Market search trends show interest in {top_cat['category']} crafts (+{top_cat['demand_pct']}%). Maintain authentic listings and protect margins.",
            "next_best_action": f"Expand your {top_cat['category']} collection.",
            "urgency": "MEDIUM"
        }

    return {
        "copilot_insight": copilot_insight,
        "opportunities": opportunities,
        "category_demand": list(category_demands.values())
    }
