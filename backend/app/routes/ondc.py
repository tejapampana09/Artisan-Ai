"""
ONDC / Beckn Integration Adapter Prototype Router.
Provides a local integration prototype of Beckn protocol schema endpoints
for catalog discovery, quote generation, and order handling.

Note: This is an integration prototype adapter, not live network integration
or official ONDC certification.
"""

from decimal import Decimal
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import update

from backend.app.database import get_db
from backend.app.models import Product, Order, Event
from backend.app.config import ONDC_PROTOTYPE_ENABLED

def check_ondc_prototype_enabled():
    if not ONDC_PROTOTYPE_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ONDC Integration Adapter Prototype is disabled in this environment."
        )

router = APIRouter(
    prefix="/api/ondc", 
    tags=["ONDC Integration Prototype"],
    dependencies=[Depends(check_ondc_prototype_enabled)]
)

class ONDCSearchIntent(BaseModel):
    category: Optional[str] = None
    query: Optional[str] = None

class ONDCSearchRequest(BaseModel):
    transaction_id: Optional[str] = Field(default=None)
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
    """ONDC /search catalog discovery endpoint (Prototype Adapter)."""
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
            "fulfillment_id": "F1_PROTOTYPE_EXPRESS"
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
                        "descriptor": {"name": "Artisan AI Marketplace Gateway (Prototype)"},
                        "items": items
                    }
                ]
            }
        }
    }

@router.post("/select")
def ondc_select(req: ONDCSelectRequest, db: Session = Depends(get_db)):
    """ONDC /select quote generation endpoint (Prototype Adapter)."""
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found on local ONDC registry")

    if product.stock < req.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock for requested quantity")

    unit_price = Decimal(str(product.price))
    item_total = unit_price * req.quantity
    estimated_delivery_fee = Decimal("50.00")
    grand_total = item_total + estimated_delivery_fee

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
                        {"title": "Estimated Delivery Fee (Prototype Adapter)", "price": {"currency": "INR", "value": str(estimated_delivery_fee)}}
                    ]
                }
            }
        }
    }

@router.post("/init")
def ondc_init(req: ONDCInitRequest, db: Session = Depends(get_db)):
    """ONDC /init order drafting endpoint (Prototype Adapter)."""
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    unit_price = Decimal(str(product.price))
    estimated_delivery_fee = Decimal("50.00")
    grand_total = (unit_price * req.quantity) + estimated_delivery_fee

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
    """
    ONDC /confirm atomic order creation endpoint.
    Uses database-level conditional update (WHERE stock >= quantity) to prevent race conditions.
    """
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Atomic Database-Level Conditional Decrement (prevents race conditions under concurrency)
    stmt = (
        update(Product)
        .where(Product.id == req.product_id, Product.stock >= req.quantity)
        .values(stock=Product.stock - req.quantity)
    )
    result = db.execute(stmt)
    if result.rowcount == 0:
        db.rollback()
        prod_check = db.query(Product).filter(Product.id == req.product_id).first()
        available = prod_check.stock if prod_check else 0
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock unavailable or concurrent order collision: requested {req.quantity}, available {available}."
        )

    unit_price = Decimal(str(product.price))
    total_price = unit_price * req.quantity

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
        metadata_info=f'{{"source": "ONDC_GATEWAY_PROTOTYPE", "quantity": {req.quantity}}}'
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
