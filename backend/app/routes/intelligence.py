from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User, Product, Order, Enquiry, Event
from backend.app.schemas import (
    SellerDashboardResponse, DeliveryStatusBreakdown, ProductPerformance
)
from backend.app.services.auth import get_current_user
from backend.app.services.demand_engine import calculate_category_demand, generate_seller_opportunities

router = APIRouter(prefix="/api", tags=["Market Intelligence & Seller Copilot"])

@router.get("/market/demand")
def get_market_demand(db: Session = Depends(get_db)):
    return calculate_category_demand(db)

@router.get("/seller/opportunities")
def get_seller_opportunities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return generate_seller_opportunities(db, current_user.id)

@router.get("/seller/copilot-insight")
def get_copilot_insight(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = generate_seller_opportunities(db, current_user.id)
    return result["copilot_insight"]

@router.get("/seller/dashboard", response_model=SellerDashboardResponse)
def get_seller_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    seller_products = db.query(Product).filter(Product.seller_id == current_user.id).all()
    seller_product_ids = [p.id for p in seller_products]

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
    
    views_by_prod = {}
    for ev in event_views:
        views_by_prod[ev.product_id] = views_by_prod.get(ev.product_id, 0) + 1
        
    total_views = sum(views_by_prod.values())

    status_counts = {"CONFIRMED": 0, "PROCESSING": 0, "SHIPPED": 0, "DELIVERED": 0, "CANCELLED": 0}
    total_revenue = 0.0
    units_sold = 0
    
    prod_stats = {
        p.id: {"units_sold": 0, "revenue": 0.0, "orders_count": 0}
        for p in seller_products
    }

    for ord in orders:
        st = (ord.status or "CONFIRMED").upper()
        if st in status_counts:
            status_counts[st] += 1
            
        if st != "CANCELLED":
            tot = float(ord.total_price or 0.0)
            total_revenue += tot
            units_sold += ord.quantity
            
            if ord.product_id in prod_stats:
                prod_stats[ord.product_id]["units_sold"] += ord.quantity
                prod_stats[ord.product_id]["revenue"] += tot
                prod_stats[ord.product_id]["orders_count"] += 1

    perf_list = []
    for p in seller_products:
        st = prod_stats.get(p.id, {"units_sold": 0, "revenue": 0.0, "orders_count": 0})
        perf_list.append(ProductPerformance(
            product_id=p.id,
            title=p.title,
            category=p.category,
            price=float(p.price),
            stock=p.stock,
            status=p.status,
            image_url=p.image_url,
            views=views_by_prod.get(p.id, 0),
            units_sold=st["units_sold"],
            revenue=st["revenue"],
            orders_count=st["orders_count"]
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
