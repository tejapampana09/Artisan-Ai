import json
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Product, PricingDecision, User
from backend.app.schemas import (
    PriceRecommendationResponse,
    PriceDecisionRequest,
    PriceDecisionResponse
)
from backend.app.services.pricing_engine import (
    calculate_price_recommendation,
    process_auto_smart_pricing
)
from backend.app.services.auth import get_current_user

router = APIRouter(prefix="/api/products", tags=["Explainable Dynamic Pricing"])

@router.get("/{product_id}/price-recommendation", response_model=PriceRecommendationResponse)
def get_price_recommendation(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    recommendation = calculate_price_recommendation(product, db)
    return recommendation

@router.post("/{product_id}/price-decision", response_model=PriceDecisionResponse, status_code=status.HTTP_200_OK)
def submit_price_decision(
    product_id: int,
    decision_req: PriceDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    # Seller Ownership Validation
    if product.seller_id and current_user.id and product.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to make pricing decisions for another artisan's product."
        )

    # Calculate latest recommendation
    rec = calculate_price_recommendation(product, db)
    prev_price = Decimal(str(product.price)).quantize(Decimal("0.01"))
    rec_price = Decimal(str(rec["recommended_price"])).quantize(Decimal("0.01"))

    if decision_req.decision == "ACCEPT":
        # Seller accepts: explicitly update product price
        product.price = rec_price
        applied_price = rec_price
    else:
        # Seller rejects: retain previous price unchanged
        applied_price = prev_price

    # Record decision for auditability
    decision_record = PricingDecision(
        product_id=product.id,
        decision=decision_req.decision,
        previous_price=prev_price,
        recommended_price=rec_price,
        applied_price=applied_price,
        demand_factor=Decimal(str(rec["demand_factor"])).quantize(Decimal("0.0001")),
        market_adjustment=Decimal(str(rec["market_adjustment"])).quantize(Decimal("0.0001")),
        reasoning_json=json.dumps(rec["reasoning"]),
        timestamp=datetime.now(timezone.utc)
    )
    db.add(decision_record)
    db.commit()
    db.refresh(decision_record)
    db.refresh(product)

    return decision_record

@router.patch("/{product_id}/toggle-smart-pricing")
def toggle_smart_pricing(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )
    if product.seller_id and current_user.id and product.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify pricing settings for this product."
        )

    product.auto_smart_pricing_enabled = not bool(getattr(product, "auto_smart_pricing_enabled", False))
    db.commit()
    db.refresh(product)

    # Autonomous execution: if enabled, immediately run auto-pricing cycle
    decision_record = None
    if product.auto_smart_pricing_enabled:
        decision_record = process_auto_smart_pricing(product, db)

    return {
        "product_id": product.id,
        "auto_smart_pricing_enabled": product.auto_smart_pricing_enabled,
        "auto_pricing_applied": decision_record is not None,
        "decision": decision_record.decision if decision_record else None,
        "applied_price": float(decision_record.applied_price) if decision_record else float(product.price),
        "message": f"Auto Smart Pricing is now {'ENABLED' if product.auto_smart_pricing_enabled else 'DISABLED'}"
    }

@router.post("/{product_id}/evaluate-auto-pricing")
def evaluate_auto_pricing(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Evaluates and applies autonomous dynamic pricing for a product if auto_smart_pricing_enabled is True.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )
    if product.seller_id and current_user.id and product.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to execute pricing evaluation for this product."
        )

    decision_record = process_auto_smart_pricing(product, db)
    return {
        "product_id": product.id,
        "auto_smart_pricing_enabled": product.auto_smart_pricing_enabled,
        "auto_pricing_applied": decision_record is not None,
        "current_price": float(product.price),
        "decision": decision_record.decision if decision_record else "NO_CHANGE"
    }

@router.post("/auto-pricing/run-all-cycles")
def run_all_auto_pricing_cycles(db: Session = Depends(get_db)):
    """
    Scheduled / System cycle endpoint: Runs auto-pricing evaluation on all products with auto_smart_pricing_enabled == True.
    """
    products = db.query(Product).filter(Product.auto_smart_pricing_enabled == True).all()
    applied_count = 0
    records = []
    for p in products:
        rec = process_auto_smart_pricing(p, db)
        if rec:
            applied_count += 1
            records.append({
                "product_id": p.id,
                "previous_price": float(rec.previous_price),
                "applied_price": float(rec.applied_price),
                "decision": rec.decision
            })
    return {
        "status": "COMPLETED",
        "total_smart_products": len(products),
        "applied_updates_count": applied_count,
        "updates": records
    }

