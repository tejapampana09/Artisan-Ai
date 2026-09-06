"""
ONDC (Open Network for Digital Commerce) Beckn Protocol Adapter Router.
Enables traditional Indian artisans to publish craft listings onto the national ONDC network.
Supported Beckn APIs:
- POST /api/ondc/search  (Catalog discovery)
- POST /api/ondc/select  (Quote generation)
- POST /api/ondc/init    (Order initialization)
- POST /api/ondc/confirm (Atomic order confirmation & stock decrement)
"""

from decimal import Decimal
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Product, Order, Event

router = APIRouter(prefix="/api/ondc", tags=["ONDC Gateway"])

class ONDCSearchIntent(BaseModel):
    category: Optional[str] = None
    query: Optional[str] = None

class ONDCSearchRequest(BaseModel):
    transaction_id: Optional[str] = Field(default="tx_ondc_demo")
    intent: Optional[ONDCSearchIntent] = None

class ONDCSelectRequest(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1)

class ONDCInitRequest(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1)
    buyer_name: str
    buyer_phone: str
    delivery_address: str

class ONDCConfirmRequest(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1)
    buyer_name: str
    buyer_phone: str
    delivery_address: str

@router.post("/search")
def ondc_search(req: ONDCSearchRequest, db: Session = Depends(get_db)):
    """ONDC /search catalog discovery endpoint."""
    query = db.query(Product).filter(Product.status == "PUBLISHED", Product.stock > 0)
    if req.intent:
        if req.intent.category:
            query = query.filter(Product.category.ilike(f"%{req.intent.category}%"))
        if req.intent.query:
            query = query.filter(Product.title.ilike(f"%{req.intent.query}%"))

    products = query.all()
    items = []
    for p in products:
        items.append({
            "id": str(p.id),
            "descriptor": {
                "name": p.title,
                "short_desc": p.description or "",
                "images": [p.image_url] if p.image_url else []
            },
            "category_id": p.category,
            "price": {
                "currency": "INR",
                "value": str(p.price)
            },
            "quantity": {
                "available": {"count": p.stock}
            },
            "fulfillment_id": "F1_EXPRESS",
            "ondc_certified": True
        })

    return {
        "context": {
            "domain": "nic2004:52110",
            "action": "on_search",
            "country": "IND",
            "city": "std:080",
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        "message": {
            "catalog": {
                "bpp/providers": [
                    {
                        "id": "ARTISAN_AI_BPP",
                        "descriptor": {"name": "Artisan AI Marketplace Gateway"},
                        "items": items
                    }
                ]
            }
        }
    }

@router.post("/select")
def ondc_select(req: ONDCSelectRequest, db: Session = Depends(get_db)):
    """ONDC /select quote generation endpoint."""
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found on ONDC registry")

    if product.stock < req.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock for requested quantity")

    unit_price = Decimal(str(product.price))
    item_total = unit_price * req.quantity
    delivery_fee = Decimal("50.00")
    grand_total = item_total + delivery_fee

    return {
        "context": {
            "action": "on_select",
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        "message": {
            "order": {
                "provider": {"id": "ARTISAN_AI_BPP"},
                "items": [{"id": str(product.id), "quantity": {"count": req.quantity}}],
                "quote": {
                    "price": {"currency": "INR", "value": str(grand_total)},
                    "breakup": [
                        {"title": product.title, "price": {"currency": "INR", "value": str(item_total)}},
                        {"title": "Delivery & Handloom Logistics", "price": {"currency": "INR", "value": str(delivery_fee)}}
                    ]
                }
            }
        }
    }

@router.post("/init")
def ondc_init(req: ONDCInitRequest, db: Session = Depends(get_db)):
    """ONDC /init order drafting endpoint."""
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    unit_price = Decimal(str(product.price))
    grand_total = (unit_price * req.quantity) + Decimal("50.00")

    return {
        "context": {"action": "on_init", "timestamp": datetime.now(timezone.utc).isoformat()},
        "message": {
            "order": {
                "provider": {"id": "ARTISAN_AI_BPP"},
                "items": [{"id": str(product.id), "quantity": {"count": req.quantity}}],
                "billing": {"name": req.buyer_name, "phone": req.buyer_phone},
                "fulfillment": {"end": {"location": {"address": {"name": req.delivery_address}}}},
                "quote": {"price": {"currency": "INR", "value": str(grand_total)}}
            }
        }
    }

@router.post("/confirm")
def ondc_confirm(req: ONDCConfirmRequest, db: Session = Depends(get_db)):
    """ONDC /confirm atomic order creation endpoint."""
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.stock < req.quantity:
        raise HTTPException(status_code=400, detail="Stock unavailable")

    unit_price = Decimal(str(product.price))
    total_price = unit_price * req.quantity

    # Atomic stock decrement
    product.stock -= req.quantity

    new_order = Order(
        product_id=product.id,
        user_id=None,
        buyer_name=req.buyer_name,
        buyer_phone=req.buyer_phone,
        quantity=req.quantity,
        unit_price=unit_price,
        total_price=total_price,
        delivery_address=req.delivery_address,
        status="CONFIRMED"
    )
    db.add(new_order)

    # Record ONDC ORDER telemetry event
    db.add(Event(
        event_type="ORDER",
        product_id=product.id,
        category=product.category,
        metadata_info=f'{{"source": "ONDC_GATEWAY", "quantity": {req.quantity}}}'
    ))

    db.commit()
    db.refresh(new_order)

    return {
        "context": {"action": "on_confirm", "timestamp": datetime.now(timezone.utc).isoformat()},
        "message": {
            "order": {
                "id": f"ONDC_ORD_{new_order.id}",
                "state": "ACCEPTED",
                "fulfillment_status": "CONFIRMED",
                "items": [{"id": str(product.id), "quantity": req.quantity}],
                "total_price": float(total_price)
            }
        }
    }
