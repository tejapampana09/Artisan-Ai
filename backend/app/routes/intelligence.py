from typing import List, Dict, Any, Optional, cast
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User, Product, Order, Enquiry, Event
from backend.app.schemas import (
    SellerDashboardResponse, DeliveryStatusBreakdown, ProductPerformance,
    BuyerCopilotRequest, BuyerCopilotResponse, ProductResponse
)
from backend.app.services.auth import get_current_user, get_optional_current_user
from backend.app.services.demand_engine import calculate_category_demand, generate_seller_opportunities

def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value)


router = APIRouter(prefix="/api", tags=["Market Intelligence & Seller Copilot"])

@router.get("/market/demand")
def get_market_demand(db: Session = Depends(get_db)):
    return calculate_category_demand(db)

@router.get("/seller/opportunities")
def get_seller_opportunities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = _as_int(cast(Any, current_user.id), 0)
    return generate_seller_opportunities(db, user_id)

@router.get("/seller/copilot-insight")
def get_copilot_insight(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = _as_int(cast(Any, current_user.id), 0)
    result = generate_seller_opportunities(db, user_id)
    return result["copilot_insight"]

@router.get("/seller/dashboard", response_model=SellerDashboardResponse)
def get_seller_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = _as_int(cast(Any, current_user.id), 0)
    seller_products = db.query(Product).filter(Product.seller_id == user_id).all()
    seller_product_ids = [_as_int(cast(Any, p.id), 0) for p in seller_products]

    if not seller_product_ids:
        return SellerDashboardResponse(
            total_revenue=0.0,
            units_sold=0,
            total_orders=0,
            total_views=0,
            total_enquiries=0,
            delivery_status=DeliveryStatusBreakdown(),
            product_performance=[]
        )

    orders = db.query(Order).filter(Order.product_id.in_(seller_product_ids)).all()
    enquiries_count = db.query(Enquiry).filter(Enquiry.product_id.in_(seller_product_ids)).count()

    event_views = db.query(Event).filter(
        Event.product_id.in_(seller_product_ids),
        Event.event_type.in_(["VIEW", "SEARCH", "SAVE"])
    ).all()
    
    views_by_prod: Dict[int, int] = {}
    for ev in event_views:
        product_id = _as_int(cast(Any, ev.product_id), 0)
        views_by_prod[product_id] = views_by_prod.get(product_id, 0) + 1

    total_views = sum(views_by_prod.values())

    status_counts = {"CONFIRMED": 0, "PROCESSING": 0, "SHIPPED": 0, "DELIVERED": 0, "CANCELLED": 0}
    total_revenue = 0.0
    units_sold = 0

    prod_stats: Dict[int, Dict[str, Any]] = {
        _as_int(cast(Any, p.id), 0): {"units_sold": 0, "revenue": 0.0, "orders_count": 0}
        for p in seller_products
    }

    for ord in orders:
        order_status = _as_str(ord.status, "CONFIRMED").upper()
        if order_status in status_counts:
            status_counts[order_status] += 1

        if order_status != "CANCELLED":
            total_price = _as_float(cast(Any, ord.total_price), 0.0)
            quantity = _as_int(cast(Any, ord.quantity), 0)
            total_revenue += total_price
            units_sold += quantity

            product_id = _as_int(cast(Any, ord.product_id), 0)
            if product_id in prod_stats:
                prod_stats[product_id]["units_sold"] = _as_int(prod_stats[product_id].get("units_sold"), 0) + quantity
                prod_stats[product_id]["revenue"] = _as_float(prod_stats[product_id].get("revenue"), 0.0) + total_price
                prod_stats[product_id]["orders_count"] = _as_int(prod_stats[product_id].get("orders_count"), 0) + 1

    perf_list = []
    for p in seller_products:
        product_id = _as_int(cast(Any, p.id), 0)
        title = _as_str(p.title, "")
        category = _as_str(p.category, "Handcrafted")
        status_value = _as_str(p.status, "PUBLISHED")
        image_url = cast(Optional[str], p.image_url) if p.image_url is not None else None
        st = prod_stats.get(product_id, {"units_sold": 0, "revenue": 0.0, "orders_count": 0})
        perf_list.append(ProductPerformance(
            product_id=product_id,
            title=title,
            category=category,
            price=_as_float(cast(Any, p.price), 0.0),
            stock=_as_int(cast(Any, p.stock), 0),
            status=status_value,
            image_url=image_url,
            views=views_by_prod.get(product_id, 0),
            units_sold=_as_int(st.get("units_sold"), 0),
            revenue=_as_float(st.get("revenue"), 0.0),
            orders_count=_as_int(st.get("orders_count"), 0)
        ))

    return SellerDashboardResponse(
        total_revenue=total_revenue,
        units_sold=units_sold,
        total_orders=len(orders),
        total_views=total_views,
        total_enquiries=enquiries_count,
        delivery_status=DeliveryStatusBreakdown(
            confirmed=status_counts["CONFIRMED"],
            processing=status_counts["PROCESSING"],
            shipped=status_counts["SHIPPED"],
            delivered=status_counts["DELIVERED"],
            cancelled=status_counts["CANCELLED"]
        ),
        product_performance=perf_list
    )

from fastapi.responses import Response
import csv
import io

@router.get("/seller/analytics/export")
def export_seller_analytics_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates a downloadable CSV report of seller products, cost basis, margins, and sales volume."""
    user_id = _as_int(cast(Any, current_user.id), 0)
    seller_products = db.query(Product).filter(Product.seller_id == user_id).all()
    seller_product_ids = [_as_int(cast(Any, p.id), 0) for p in seller_products]

    output = io.StringIO()
    writer = csv.writer(output)

    # Write Header
    writer.writerow([
        "Product ID", "Title", "Category", "Listing Price (INR)", "Stock Available",
        "Material Cost", "Labour Cost", "Packaging Cost", "Protected Margin %",
        "Units Sold", "Total Revenue (INR)", "Status"
    ])

    if seller_product_ids:
        orders = db.query(Order).filter(Order.product_id.in_(seller_product_ids)).all()
        sales_map: Dict[int, Dict[str, float]] = {}
        for ord in orders:
            order_status = _as_str(ord.status, "CONFIRMED").upper()
            if order_status != "CANCELLED":
                product_id = _as_int(cast(Any, ord.product_id), 0)
                if product_id not in sales_map:
                    sales_map[product_id] = {"units": 0.0, "revenue": 0.0}
                sales_map[product_id]["units"] += float(_as_int(cast(Any, ord.quantity), 0))
                sales_map[product_id]["revenue"] += _as_float(cast(Any, ord.total_price), 0.0)

        for p in seller_products:
            product_id = _as_int(cast(Any, p.id), 0)
            st = sales_map.get(product_id, {"units": 0.0, "revenue": 0.0})
            writer.writerow([
                product_id,
                _as_str(p.title, ""),
                _as_str(p.category, "Handcrafted"),
                f"{_as_float(cast(Any, p.price), 0.0):.2f}",
                _as_int(cast(Any, p.stock), 0),
                f"{_as_float(cast(Any, p.material_cost), 0.0):.2f}",
                f"{_as_float(cast(Any, p.labour_cost), 0.0):.2f}",
                f"{_as_float(cast(Any, p.packaging_cost), 0.0):.2f}",
                f"{_as_float(cast(Any, p.min_margin_pct), 0.0) * 100:.1f}%",
                int(st["units"]),
                f"{_as_float(st.get('revenue'), 0.0):.2f}",
                _as_str(p.status, "PUBLISHED")
            ])

    filename = f"Artisan_Analytics_Report_{current_user.id}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

from backend.app.services.ai_adapter import extract_buyer_intent, generate_buyer_explanation

@router.post("/buyer/copilot-chat", response_model=BuyerCopilotResponse)
async def buyer_copilot_chat(
    req: BuyerCopilotRequest,
    db: Session = Depends(get_db)
):
    """
    Multilingual AI Buyer Guide & Live Marketplace Search Engine:
    - Intent Extraction: Uses Gemini LLM when available, falls back to refined regex & craft keyword parsing.
    - Database Search: Queries published products using category, budget cap, and refined non-stopword keywords.
    - Honest Fallback: Distinguishes direct search matches from fallback popular items with explicit notices (no false GI claims).
    - Conversational Explanation: Uses Gemini LLM or localized templates to summarize recommendations.
    """
    # 1. Hybrid Intent Extraction
    intent = await extract_buyer_intent(
        message=req.message,
        language=req.language or "te",
        category_hint=req.category,
        max_budget_hint=req.max_budget
    )

    matched_cat = intent.get("category")
    budget = intent.get("max_budget")
    keywords = intent.get("keywords", [])

    # 2. Perform Live Database Query
    query = db.query(Product).filter(Product.status == "PUBLISHED")

    if matched_cat:
        query = query.filter(Product.category == matched_cat)

    if budget and budget > 0:
        query = query.filter(Product.price <= budget)

    if keywords:
        from sqlalchemy import or_
        filters = []
        for word in keywords:
            filters.append(Product.title.ilike(f"%{word}%"))
            filters.append(Product.description.ilike(f"%{word}%"))
            filters.append(Product.category.ilike(f"%{word}%"))
            filters.append(Product.materials.ilike(f"%{word}%"))
        query = query.filter(or_(*filters))

    matching_products = query.order_by(Product.id.desc()).limit(6).all()
    is_fallback = False

    # 3. Fallback to top published products if specific search yielded no results
    if not matching_products:
        is_fallback = True
        matching_products = db.query(Product).filter(Product.status == "PUBLISHED").order_by(Product.id.desc()).limit(6).all()

    match_count = len(matching_products)
    product_titles = [p.title for p in matching_products]

    # 4. Generate Natural Language Conversational Explanation
    reply = await generate_buyer_explanation(
        user_message=req.message,
        language=req.language or "te",
        product_titles=product_titles,
        match_count=0 if is_fallback else match_count,
        is_fallback=is_fallback
    )

    return BuyerCopilotResponse(
        reply_text=reply,
        language=(req.language or "te").lower(),
        recommended_products=[
            ProductResponse.model_validate(p) for p in matching_products
        ],
        search_query_used=req.message,
        match_count=0 if is_fallback else match_count,
        is_fallback=is_fallback
    )


