from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, update

from backend.app.database import get_db
from backend.app.models import Event, Product, User, Order, Enquiry
from backend.app.schemas import (
    EventCreate, EventResponse, EnquiryCreate, EnquiryResponse, 
    OrderCreate, OrderResponse, ProductResponse
)
from backend.app.services.auth import get_current_user

router = APIRouter(prefix="/api", tags=["Events & Marketplace"])

@router.post("/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def record_event(
    event_in: EventCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Security: Disallow client-spoofed ORDER / ENQUIRY events via telemetry
    if event_in.event_type.upper() in ("ORDER", "ENQUIRY"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Direct submission of '{event_in.event_type}' via telemetry is not permitted. Use the official /api/marketplace/order or /api/marketplace/enquire endpoints."
        )

    category = event_in.category

    # If product_id given and no category, extract from product
    if event_in.product_id and not category:
        prod = db.query(Product).filter(Product.id == event_in.product_id).first()
        if prod:
            category = prod.category

    evt = Event(
        event_type=event_in.event_type,
        product_id=event_in.product_id,
        category=category,
        query=event_in.query,
        metadata_info=event_in.metadata_info,
        user_id=current_user.id if current_user else None,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(evt)
    db.commit()
    db.refresh(evt)
    return evt

@router.get("/events", response_model=List[EventResponse])
def get_events(
    event_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    product_id: Optional[int] = Query(None),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(Event)
    if event_type:
        query = query.filter(Event.event_type == event_type)
    if category:
        query = query.filter(Event.category == category)
    if product_id:
        query = query.filter(Event.product_id == product_id)
    return query.order_by(Event.id.desc()).limit(limit).all()

@router.post("/marketplace/enquire", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def submit_enquiry(
    enquiry: EnquiryCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == enquiry.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    buyer_name = enquiry.buyer_name.strip() if enquiry.buyer_name and enquiry.buyer_name.strip() else current_user.name
    buyer_phone = enquiry.buyer_phone.strip() if enquiry.buyer_phone and enquiry.buyer_phone.strip() else (current_user.phone or "N/A")

    # 1. Store structured enquiry in dedicated secure relation
    enquiry_record = Enquiry(
        product_id=product.id,
        user_id=current_user.id,
        buyer_name=buyer_name,
        buyer_phone=buyer_phone,
        quantity=enquiry.quantity,
        message=enquiry.message.strip() if enquiry.message else None,
        created_at=datetime.now(timezone.utc)
    )
    db.add(enquiry_record)

    # 2. Record sanitized analytics event WITHOUT personal phone numbers
    sanitized_meta = f"Quantity: {enquiry.quantity} unit(s) | Enquiry Lead"
    
    evt = Event(
        event_type="ENQUIRY",
        product_id=product.id,
        category=product.category,
        user_id=current_user.id,
        metadata_info=sanitized_meta,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(evt)
    db.commit()
    db.refresh(evt)
    return evt

@router.get("/marketplace/enquiries", response_model=List[EnquiryResponse])
def list_enquiries(
    product_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Enquiry)
    if product_id:
        query = query.filter(Enquiry.product_id == product_id)

    # Privacy isolation: Buyer sees own enquiries; Seller sees enquiries for own products; Admin sees all
    if current_user.role != "ADMIN":
        seller_product_ids = db.query(Product.id).filter(Product.seller_id == current_user.id)
        query = query.filter(
            (Enquiry.user_id == current_user.id) | (Enquiry.product_id.in_(seller_product_ids))
        )
    return query.order_by(Enquiry.id.desc()).all()

@router.post("/marketplace/order", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def place_order(
    order: OrderCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == order.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Atomic Row-Level Conditional Update: Prevents overselling & race conditions
    stmt = (
        update(Product)
        .where(Product.id == order.product_id, Product.stock >= order.quantity)
        .values(stock=Product.stock - order.quantity)
    )
    result = db.execute(stmt)
    if result.rowcount == 0:
        db.rollback()
        prod_check = db.query(Product).filter(Product.id == order.product_id).first()
        available = prod_check.stock if prod_check else 0
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock: requested {order.quantity} units, but only {available} available."
        )

    try:
        unit_price = Decimal(str(product.price)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        quantity_dec = Decimal(str(order.quantity))
        total_price = (unit_price * quantity_dec).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        buyer_name = order.buyer_name.strip() if order.buyer_name and order.buyer_name.strip() else current_user.name
        buyer_phone = order.buyer_phone.strip() if order.buyer_phone and order.buyer_phone.strip() else (current_user.phone or None)

        # 1. Dedicated structured order record tied to authenticated user
        order_record = Order(
            product_id=product.id,
            user_id=current_user.id,
            buyer_name=buyer_name,
            buyer_phone=buyer_phone,
            quantity=order.quantity,
            unit_price=unit_price,
            total_price=total_price,
            delivery_address=order.delivery_address.strip(),
            status="CONFIRMED",
            created_at=datetime.now(timezone.utc)
        )
        db.add(order_record)

        # 2. Public analytics event with sanitized operational info (NO delivery address or phone PII)
        sanitized_meta = f"Quantity: {order.quantity} | Total: ₹{float(total_price):,.0f} | Status: CONFIRMED"

        evt = Event(
            event_type="ORDER",
            product_id=product.id,
            category=product.category,
            user_id=current_user.id,
            metadata_info=sanitized_meta,
            timestamp=datetime.now(timezone.utc)
        )
        db.add(evt)
        db.commit()
        db.refresh(evt)
        return evt
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Order transaction failed: {str(e)}"
        )

@router.get("/marketplace/orders", response_model=List[OrderResponse])
def list_orders(
    product_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Order)
    if product_id:
        query = query.filter(Order.product_id == product_id)

    # Privacy isolation: Buyer sees own orders; Seller sees orders for own products; Admin sees all
    if current_user.role != "ADMIN":
        seller_product_ids = db.query(Product.id).filter(Product.seller_id == current_user.id)
        query = query.filter(
            (Order.user_id == current_user.id) | (Order.product_id.in_(seller_product_ids))
        )
    return query.order_by(Order.id.desc()).all()

@router.get("/marketplace/trending", response_model=List[ProductResponse])
def get_trending_products(limit: int = Query(8, le=20), db: Session = Depends(get_db)):
    """
    Ranks products using the exact weighted Demand Engine scoring:
    ORDER: 10, ENQUIRY: 6, SAVE: 4, SEARCH: 2, VIEW: 1
    Ensures consistent marketplace & seller intelligence signals.
    """
    from sqlalchemy import case

    weighted_score = func.sum(
        case(
            (Event.event_type == "ORDER", 10),
            (Event.event_type == "ENQUIRY", 6),
            (Event.event_type == "SAVE", 4),
            (Event.event_type == "SEARCH", 2),
            (Event.event_type == "VIEW", 1),
            else_=1
        )
    ).label("score")

    event_counts = (
        db.query(Event.product_id, weighted_score)
        .filter(Event.product_id.isnot(None))
        .group_by(Event.product_id)
        .order_by(weighted_score.desc())
        .all()
    )
    product_ids = [row[0] for row in event_counts]

    if product_ids:
        products = db.query(Product).filter(Product.id.in_(product_ids)).all()
        id_to_prod = {p.id: p for p in products}
        ordered = [id_to_prod[pid] for pid in product_ids if pid in id_to_prod]
        return ordered[:limit]

    return db.query(Product).order_by(Product.id.desc()).limit(limit).all()
