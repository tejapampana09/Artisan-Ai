from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import User, Product, Event
from backend.app.services.auth import get_current_user, get_optional_current_user, require_admin
from backend.app.services.ml_demand_engine import MLDemandEngine, predict_product_demand

router = APIRouter(prefix="/api/ml", tags=["ML Demand Engine"])

MIN_REAL_EVENTS_RETRAIN_THRESHOLD = 20

class PredictDemandRequest(BaseModel):
    product_id: int = Field(..., description="ID of an active published catalog product with interaction telemetry")

def _validate_product_for_ml_demand(product: Optional[Product], product_id: int, current_user: Optional[User]) -> Product:
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )

    # Verify seller ownership if requester is an authenticated seller
    if current_user and getattr(current_user, "role", "") == "seller":
        if product.seller_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view demand telemetry for this product."
            )

    # Verify PUBLISHED or ACTIVE status
    status_str = str(getattr(product, "status", "")).upper()
    if status_str and status_str not in ["PUBLISHED", "ACTIVE"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Product #{product_id} is in '{status_str}' status. "
                "ML Demand forecasting requires a PUBLISHED or ACTIVE catalog product with real marketplace interaction telemetry."
            )
        )

    return product

@router.get("/model-info", summary="Get active ML demand model metadata")
def get_model_info():
    engine = MLDemandEngine()
    if not engine.is_available():
        return {
            "is_available": False,
            "message": "ML Demand model is uninitialized. Running rule-based fallback.",
            "metadata": None
        }
    return {
        "is_available": True,
        "metadata": engine.metadata
    }

@router.post("/predict-demand", summary="Predict demand score for a published catalog product")
def predict_demand(
    payload: PredictDemandRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Predicts consumer demand score for an authentic published catalog product.
    Requires genuine buyer interaction telemetry (views, saves, enquiries, orders).
    """
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    valid_product = _validate_product_for_ml_demand(product, payload.product_id, current_user)
    return predict_product_demand(valid_product, db)

@router.get("/predict-demand/{product_id}", summary="Get demand prediction for a specific product ID")
def get_product_demand_prediction(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Convenience GET endpoint to retrieve ML demand prediction for a specific product ID.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    valid_product = _validate_product_for_ml_demand(product, product_id, current_user)
    return predict_product_demand(valid_product, db)

@router.post("/retrain", summary="Trigger ML model retraining (Admin Only & Real Event Threshold)")
def retrain_model(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Safely triggers ML demand model retraining.
    Enforces minimum real buyer event threshold to prevent abuse and ensure genuine data accumulation.
    """
    published_count = db.query(Product).filter(Product.status.in_(["PUBLISHED", "ACTIVE"])).count()
    real_event_count = db.query(Event).filter(Event.timestamp != None).count()

    events = db.query(Event).filter(Event.timestamp != None).all()
    earliest = min((e.timestamp for e in events if e.timestamp), default=None)
    latest = max((e.timestamp for e in events if e.timestamp), default=None)
    days_span = (latest - earliest).days if (earliest and latest) else 0

    if published_count < 20 or real_event_count < 200 or days_span < 14:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Production retraining requires at least 20 published products, 200 buyer events, and 14 days of telemetry. "
                f"Current status: {published_count}/20 products, {real_event_count}/200 events, {days_span}/14 days span. "
                "Model remains on the domain-informed bootstrap baseline."
            )
        )

    try:
        from backend.ml.train_demand_model import train_and_save_model
        new_metadata = train_and_save_model(db=db)
        if not new_metadata.get("is_real_marketplace_data", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Insufficient post-filter valid snapshots (<20 snapshots with >=7 days active exposure). "
                    "Model remains on domain-informed baseline."
                )
            )
        engine = MLDemandEngine()
        engine.load_model()
        return {
            "status": "SUCCESS",
            "message": "ML Demand model retrained and updated successfully.",
            "metrics": {
                "r2_score": new_metadata.get("r2_score"),
                "temporal_cv_r2_mean": new_metadata.get("temporal_cv_r2_mean"),
                "mae": new_metadata.get("mae"),
                "trained_at": new_metadata.get("trained_at"),
                "n_samples": new_metadata.get("n_samples")
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model retraining failed: {str(e)}"
        )
