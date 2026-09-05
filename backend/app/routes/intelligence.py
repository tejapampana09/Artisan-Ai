from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User
from backend.app.services.demand_engine import calculate_category_demand, generate_seller_opportunities

router = APIRouter(prefix="/api", tags=["Market Intelligence & Seller Copilot"])

@router.get("/market/demand")
def get_market_demand(db: Session = Depends(get_db)):
    return calculate_category_demand(db)

@router.get("/seller/opportunities")
def get_seller_opportunities(db: Session = Depends(get_db)):
    user = db.query(User).first()
    user_id = user.id if user else 1
    return generate_seller_opportunities(db, user_id)

@router.get("/seller/copilot-insight")
def get_copilot_insight(db: Session = Depends(get_db)):
    user = db.query(User).first()
    user_id = user.id if user else 1
    result = generate_seller_opportunities(db, user_id)
    return result["copilot_insight"]
