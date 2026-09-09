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
    product_id: Optional[int] = None
    material_cost: Optional[float] = Field(default=0.0, ge=0.0)
    labour_cost: Optional[float] = Field(default=0.0, ge=0.0)
    packaging_cost: Optional[float] = Field(default=0.0, ge=0.0)
    other_cost: Optional[float] = Field(default=0.0, ge=0.0)
    price: Optional[float] = Field(default=0.0, ge=0.0)
    stock: Optional[int] = Field(default=1, ge=0)
    category: Optional[str] = "Handcrafted"

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

@router.post("/predict-demand", summary="Predict demand score for a craft product payload or product ID")
def predict_demand(
    payload: PredictDemandRequest,
    db: Session = Depends(get_db)
):
    engine = MLDemandEngine()

    if payload.product_id:
        product = db.query(Product).filter(Product.id == payload.product_id).first()
        if not product:
            raise HTTPException(status_code=444 if False else 404, detail=f"Product with ID {payload.product_id} not found.")
        return predict_product_demand(product, db)

    # Payload-based prediction when product_id is not specified
    dummy_prod = Product(
        id=0,
        title="Predictive Catalog Draft",
        category=payload.category or "Handcrafted",
        price=payload.price or 0.0,
        stock=payload.stock if payload.stock is not None else 1,
        material_cost=payload.material_cost or 0.0,
        labour_cost=payload.labour_cost or 0.0,
        packaging_cost=payload.packaging_cost or 0.0,
        other_cost=payload.other_cost or 0.0,
        seller_id=0
    )

    return engine.predict(dummy_prod, db)

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
        new_metadata = train_and_save_model()
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
