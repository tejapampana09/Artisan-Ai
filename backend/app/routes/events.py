from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database import get_db
from backend.app.models import Event, Product, User
from backend.app.schemas import EventCreate, EventResponse, EnquiryCreate, OrderCreate, ProductResponse

router = APIRouter(prefix="/api", tags=["Events & Marketplace"])

@router.post("/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def record_event(event_in: EventCreate, db: Session = Depends(get_db)):
    category = event_in.category

    # If product_id given and no category, extract from product
    if event_in.product_id and not category:
        prod = db.query(Product).filter(Product.id == event_in.product_id).first()
        if prod:
            category = prod.category

    user = db.query(User).first()
    user_id = user.id if user else None

    evt = Event(
        event_type=event_in.event_type,
        product_id=event_in.product_id,
        category=category,
        query=event_in.query,
        metadata_info=event_in.metadata_info,
        user_id=user_id,
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
def submit_enquiry(enquiry: EnquiryCreate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == enquiry.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    meta = f"Buyer: {enquiry.buyer_name} ({enquiry.buyer_phone}) | Qty: {enquiry.quantity} units | Msg: {enquiry.message or 'N/A'}"
    
    evt = Event(
        event_type="ENQUIRY",
        product_id=product.id,
        category=product.category,
        metadata_info=meta,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(evt)
    db.commit()
    db.refresh(evt)
    return evt

@router.post("/marketplace/order", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def place_order(order: OrderCreate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == order.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Strict Stock Integrity Validation
    if product.stock <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product '{product.title}' is currently out of stock."
        )
    if product.stock < order.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock: requested {order.quantity} units, but only {product.stock} available."
        )

    # Decrement inventory upon confirmed availability
    product.stock -= order.quantity

    meta = f"Buyer: {order.buyer_name} | Qty: {order.quantity} | Total: ₹{product.price * order.quantity} | Delivery: {order.delivery_address}"

    evt = Event(
        event_type="ORDER",
        product_id=product.id,
        category=product.category,
        metadata_info=meta,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(evt)
    db.commit()
    db.refresh(evt)
    db.refresh(product)
    return evt

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
