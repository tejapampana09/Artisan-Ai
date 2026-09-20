from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import User, Product, Event
from backend.app.services.auth import get_current_user
from backend.app.services.ml_demand_engine import MLDemandEngine, predict_product_demand

router = APIRouter(prefix="/api/ml", tags=["ML Demand Engine"])

MIN_REAL_EVENTS_RETRAIN_THRESHOLD = 20

class PredictDemandRequest(BaseModel):
    product_id: int = Field(..., description="ID of an active published catalog product with interaction telemetry")

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

@router.post("/predict-demand", summary="Predict 7-day demand for a published catalog product")
def predict_demand(
    payload: PredictDemandRequest,
    db: Session = Depends(get_db)
):
    """
    Predicts 7-day consumer demand for an authentic published catalog product.
    Requires genuine buyer interaction telemetry (views, saves, enquiries, orders).
    """
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {payload.product_id} not found."
        )
    return predict_product_demand(product, db)

@router.get("/predict-demand/{product_id}", summary="Get 7-day demand prediction for a specific product ID")
def get_product_demand_prediction(
    product_id: int,
    db: Session = Depends(get_db)
):
    """
    Convenience GET endpoint to retrieve 7-day ML demand prediction for a specific product ID.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
    return predict_product_demand(product, db)

@router.post("/retrain", summary="Trigger ML model retraining (Requires Auth & Real Event Threshold)")
def retrain_model(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Safely triggers ML demand model retraining.
    Enforces minimum real buyer event threshold to prevent abuse and ensure genuine data accumulation.
    """
    real_event_count = db.query(Event).count()

    if real_event_count < MIN_REAL_EVENTS_RETRAIN_THRESHOLD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Production retraining requires at least {MIN_REAL_EVENTS_RETRAIN_THRESHOLD} real buyer interaction events. "
                f"Current recorded events: {real_event_count}. Model remains on cold-start bootstrap state."
            )
        )

    try:
        from backend.ml.train_demand_model import train_and_save_model
        new_metadata = train_and_save_model(db=db)
        engine = MLDemandEngine()
        engine.load_model()
        return {
            "status": "SUCCESS",
            "message": "ML Demand model retrained and updated successfully.",
            "metrics": {
                "r2_score": new_metadata.get("r2_score"),
                "mae": new_metadata.get("mae"),
                "trained_at": new_metadata.get("trained_at"),
                "n_samples": new_metadata.get("n_samples")
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model retraining failed: {str(e)}"
        )
