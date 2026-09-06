from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import func, update

from backend.app.database import get_db
from backend.app.models import Event, Product, User, Order, Enquiry
from backend.app.schemas import (
    EventCreate, EventResponse, EnquiryCreate, EnquiryReply, EnquiryResponse, 
    OrderCreate, OrderStatusUpdate, OrderResponse, ProductResponse
)
from backend.app.services.auth import get_current_user, get_optional_current_user

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
    current_user: User = Depends(get_current_user),
    auth_header: Optional[str] = Header(None, alias="Authorization")
):
    product = db.query(Product).filter(Product.id == enquiry.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if auth_header and product.seller_id and product.seller_id == current_user.id and current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self-enquiry not allowed: Artisans cannot submit buyer enquiries for their own products."
        )

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
    role_view: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Enquiry)
    if product_id:
        query = query.filter(Enquiry.product_id == product_id)

    seller_product_ids = [p.id for p in db.query(Product.id).filter(Product.seller_id == current_user.id).all()]

    if role_view == "buyer":
        query = query.filter(Enquiry.user_id == current_user.id)
    elif role_view == "seller":
        query = query.filter(Enquiry.product_id.in_(seller_product_ids))
    elif current_user.role != "ADMIN":
        query = query.filter(
            (Enquiry.user_id == current_user.id) | (Enquiry.product_id.in_(seller_product_ids))
        )

    enquiries = query.order_by(Enquiry.id.desc()).all()
    res = []
    for e in enquiries:
        prod = e.product
        res.append(EnquiryResponse(
            id=e.id,
            product_id=e.product_id,
            product_title=prod.title if prod else f"Product #{e.product_id}",
            product_image=prod.image_url if prod else None,
            seller_id=prod.seller_id if prod else None,
            seller_name=prod.seller.name if (prod and prod.seller) else None,
            user_id=e.user_id,
            buyer_name=e.buyer_name,
            buyer_phone=e.buyer_phone,
            quantity=e.quantity,
            message=e.message,
            artisan_reply=e.artisan_reply,
            replied_at=e.replied_at,
            created_at=e.created_at
        ))
    return res

@router.put("/marketplace/enquiries/{enquiry_id}/reply", response_model=EnquiryResponse)
def reply_enquiry(
    enquiry_id: int,
    payload: EnquiryReply,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    enquiry = db.query(Enquiry).filter(Enquiry.id == enquiry_id).first()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    prod = enquiry.product
    if not prod:
        raise HTTPException(status_code=404, detail="Product associated with enquiry not found")

    if prod.seller_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only the artisan who crafted this item can reply to this enquiry."
        )

    enquiry.artisan_reply = payload.artisan_reply.strip()
    enquiry.replied_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(enquiry)

    return EnquiryResponse(
        id=enquiry.id,
        product_id=enquiry.product_id,
        product_title=prod.title if prod else f"Product #{enquiry.product_id}",
        product_image=prod.image_url if prod else None,
        seller_id=prod.seller_id if prod else None,
        seller_name=prod.seller.name if (prod and prod.seller) else None,
        user_id=enquiry.user_id,
        buyer_name=enquiry.buyer_name,
        buyer_phone=enquiry.buyer_phone,
        quantity=enquiry.quantity,
        message=enquiry.message,
        artisan_reply=enquiry.artisan_reply,
        replied_at=enquiry.replied_at,
        created_at=enquiry.created_at
    )

@router.post("/marketplace/order", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def place_order(
    order: OrderCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    auth_header: Optional[str] = Header(None, alias="Authorization")
):
    product = db.query(Product).filter(Product.id == order.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if auth_header and product.seller_id and product.seller_id == current_user.id and current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self-purchase not allowed: Artisans cannot purchase their own listed crafts."
        )

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
    role_view: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Order)
    if product_id:
        query = query.filter(Order.product_id == product_id)

    seller_product_ids = [p.id for p in db.query(Product.id).filter(Product.seller_id == current_user.id).all()]

    if role_view == "buyer":
        query = query.filter(Order.user_id == current_user.id)
    elif role_view == "seller":
        query = query.filter(Order.product_id.in_(seller_product_ids))
    elif current_user.role != "ADMIN":
        query = query.filter(
            (Order.user_id == current_user.id) | (Order.product_id.in_(seller_product_ids))
        )

    orders = query.order_by(Order.id.desc()).all()
    res = []
    for o in orders:
        prod = o.product
        res.append(OrderResponse(
            id=o.id,
            product_id=o.product_id,
            product_title=prod.title if prod else f"Product #{o.product_id}",
            product_image=prod.image_url if prod else None,
            seller_id=prod.seller_id if prod else None,
            seller_name=prod.seller.name if (prod and prod.seller) else None,
            user_id=o.user_id,
            buyer_name=o.buyer_name,
            buyer_phone=o.buyer_phone,
            quantity=o.quantity,
            unit_price=float(o.unit_price),
            total_price=float(o.total_price),
            delivery_address=o.delivery_address,
            status=o.status,
            created_at=o.created_at
        ))
    return res

@router.patch("/marketplace/orders/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    prod = order.product
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    allowed_statuses = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]
    new_status = payload.status.upper().strip()
    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Allowed: {', '.join(allowed_statuses)}"
        )

    is_seller = prod.seller_id == current_user.id or current_user.role == "ADMIN"
    is_buyer = order.user_id == current_user.id

    if is_seller:
        order.status = new_status
    elif is_buyer and new_status == "CANCELLED":
        if order.status in ["SHIPPED", "DELIVERED"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order cannot be cancelled once shipped or delivered."
            )
        order.status = "CANCELLED"
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: You cannot update the status of this order."
        )

    db.commit()
    db.refresh(order)

    return OrderResponse(
        id=order.id,
        product_id=order.product_id,
        product_title=prod.title if prod else f"Product #{order.product_id}",
        product_image=prod.image_url if prod else None,
        seller_id=prod.seller_id if prod else None,
        seller_name=prod.seller.name if (prod and prod.seller) else None,
        user_id=order.user_id,
        buyer_name=order.buyer_name,
        buyer_phone=order.buyer_phone,
        quantity=order.quantity,
        unit_price=float(order.unit_price),
        total_price=float(order.total_price),
        delivery_address=order.delivery_address,
        status=order.status,
        created_at=order.created_at
    )

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
@router.get("/recommendations", response_model=List[ProductResponse])
def get_personalized_recommendations(
    limit: int = Query(8, le=20),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Buyer Weighted Recommendation Engine:
    Aggregates user's personal behavioral events weighted by interaction strength:
    ORDER (10) > ENQUIRY (6) > SAVE (4) > SEARCH (2) > VIEW (1)
    Excludes products already purchased by the user.
    Cold-start fallback: Top trending & published items.
    """
    if current_user:
        from sqlalchemy import case
        # Exclude products already ordered by this user
        purchased_pids = [
            o.product_id for o in db.query(Order.product_id).filter(Order.user_id == current_user.id).all()
        ]

        weighted_affinity = func.sum(
            case(
                (Event.event_type == "ORDER", 10),
                (Event.event_type == "ENQUIRY", 6),
                (Event.event_type == "SAVE", 4),
                (Event.event_type == "SEARCH", 2),
                (Event.event_type == "VIEW", 1),
                else_=1
            )
        ).label("affinity")

        user_cat_affinities = (
            db.query(Event.category, weighted_affinity)
            .filter(Event.user_id == current_user.id, Event.category.isnot(None))
            .group_by(Event.category)
            .order_by(weighted_affinity.desc())
            .limit(5)
            .all()
        )

        top_cats = [row[0] for row in user_cat_affinities if row[0]]
        if top_cats:
            query = db.query(Product).filter(
                Product.status == "PUBLISHED",
                Product.category.in_(top_cats)
            )
            if purchased_pids:
                query = query.filter(~Product.id.in_(purchased_pids))

            personalized = query.order_by(Product.id.desc()).limit(limit).all()
            if len(personalized) >= 1:
                return personalized

    return get_trending_products(limit=limit, db=db)

@router.get("/marketplace/ondc/catalog")
def get_ondc_catalog(db: Session = Depends(get_db)):
    """
    ONDC Beckn Protocol Catalog Endpoint (Section 14.3).
    Returns published artisan inventory formatted to ONDC retail schema.
    """
    from backend.app.services.ondc_adapter import handle_ondc_search
    return handle_ondc_search(query=None, category=None, db=db)

@router.post("/marketplace/ondc/search")
def search_ondc_catalog(payload: dict, db: Session = Depends(get_db)):
    """
    ONDC Beckn Protocol Discovery Endpoint (Section 14.3).
    """
    from backend.app.services.ondc_adapter import handle_ondc_search
    intent = payload.get("message", {}).get("intent", {})
    query = intent.get("item", {}).get("descriptor", {}).get("name")
    category = intent.get("category", {}).get("id")
    return handle_ondc_search(query=query, category=category, db=db)

# Exact Document Spec Endpoint Aliases (Section 18)
router.add_api_route("/market/trending", get_trending_products, methods=["GET"], response_model=List[ProductResponse], tags=["Market Intelligence & Seller Copilot"])
router.add_api_route("/enquiries", submit_enquiry, methods=["POST"], response_model=EventResponse, status_code=status.HTTP_201_CREATED, tags=["Events & Marketplace"])
router.add_api_route("/enquiries", list_enquiries, methods=["GET"], response_model=List[EnquiryResponse], tags=["Events & Marketplace"])
router.add_api_route("/orders", place_order, methods=["POST"], response_model=EventResponse, status_code=status.HTTP_201_CREATED, tags=["Events & Marketplace"])
router.add_api_route("/orders", list_orders, methods=["GET"], response_model=List[OrderResponse], tags=["Events & Marketplace"])
