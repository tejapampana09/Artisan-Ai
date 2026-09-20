"""
Product-Level Random Forest ML Demand Forecasting Engine (Micro Domain)
======================================================================
Responsibility:
- Per-product RandomForestRegressor inference (`predict`, `predict_product_demand`)
  Extracts 12 structured economic and telemetry features (material/labour/packaging costs,
  price-to-cost ratio, stock, category encoding, and real VIEW/SAVE/ENQUIRY/ORDER events).
- Produces individual product demand score (0–100), demand tier (NORMAL/MODERATE/HIGH),
  and dynamic pricing multiplier (0.95x–1.15x).
- Exclusively operates post-publication on authentic database products.

Distinct from:
- `backend/app/services/demand_engine.py`: Macro-level category velocity aggregation
  and seller restock opportunities synthesis.
"""

import os
import json
import logging
from typing import Dict, Any, Optional, Tuple, cast
from sqlalchemy.orm import Session
from backend.app.models import Product, Event

logger = logging.getLogger(__name__)

STANDARD_CATEGORIES = [
    "Kalamkari",
    "Wooden Toys",
    "Blue Pottery",
    "Bidriware",
    "Pochampally Ikat",
    "Handloom",
    "Other"
]

class MLDemandEngine:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MLDemandEngine, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.model = None
        self.metadata = None
        self.output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ml")
        self.load_model()
        self._initialized = True

    def load_model(self) -> bool:
        """Loads joblib model and metadata JSON if present."""
        model_path = os.path.join(self.output_dir, "demand_model.joblib")
        meta_path = os.path.join(self.output_dir, "model_meta.json")

        if not os.path.exists(model_path) or not os.path.exists(meta_path):
            logger.info("ML Demand model artifacts not found at %s. Pipeline will use rule-based fallback.", model_path)
            self.model = None
            self.metadata = None
            return False

        try:
            import joblib
            self.model = joblib.load(model_path)
            with open(meta_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
            logger.info("Loaded ML Demand Model (%s, R²=%s)", self.metadata.get("model_name"), self.metadata.get("r2_score"))
            return True
        except Exception as e:
            logger.warning("Failed to load ML Demand model: %s. Using rule-based fallback.", e)
            self.model = None
            self.metadata = None
            return False

    def is_available(self) -> bool:
        return self.model is not None and self.metadata is not None

    def get_category_encoding(self, category_name: Optional[str]) -> int:
        metadata = self.metadata
        categories = metadata.get("categories") if metadata is not None else None
        categories = categories or STANDARD_CATEGORIES
        if not category_name:
            return len(categories) - 1
        for idx, cat in enumerate(categories):
            if cat.lower() == category_name.lower():
                return idx
        return len(categories) - 1

    def extract_features(self, product: Product, db: Session) -> Tuple[list, Dict[str, Any]]:
        mat_cost = float(getattr(product, "material_cost", 0.0) or 0.0)
        lab_cost = float(getattr(product, "labour_cost", 0.0) or 0.0)
        pkg_cost = float(getattr(product, "packaging_cost", 0.0) or 0.0)
        oth_cost = float(getattr(product, "other_cost", 0.0) or 0.0)
        tot_cost = mat_cost + lab_cost + pkg_cost + oth_cost
        
        curr_price = float(getattr(product, "price", 0.0) or 0.0)
        p_ratio = round(curr_price / max(tot_cost, 1.0), 3)
        
        stock = int(getattr(product, "stock", 0) or 0)
        cat_encoded = self.get_category_encoding(getattr(product, "category", None))
        
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)

        # Canonical publication timestamp handling:
        # Prefer published_at; fall back to earliest interaction event, then created_at
        pub_time = getattr(product, "published_at", None)
        if not pub_time:
            earliest_event = db.query(Event).filter(Event.product_id == product.id).order_by(Event.timestamp.asc()).first()
            if earliest_event and earliest_event.timestamp:
                pub_time = earliest_event.timestamp
            else:
                pub_time = getattr(product, "created_at", None)

        if pub_time:
            if pub_time.tzinfo is None:
                pub_time = pub_time.replace(tzinfo=timezone.utc)
            days_active = max(0, (now - pub_time).days)
        else:
            days_active = 0
        
        # Real buyer engagement counts from events table (aligned with training window: rolling 30-day velocity)
        window_start = now - timedelta(days=30)
        recent_events = db.query(Event).filter(
            Event.product_id == product.id,
            Event.timestamp >= window_start
        ).all()
        
        # Fallback to total history if no events in last 30d (e.g. initial launch / seed catalog)
        if not recent_events:
            recent_events = db.query(Event).filter(Event.product_id == product.id).all()
        
        views = sum(1 for e in recent_events if e.event_type == "VIEW")
        saves = sum(1 for e in recent_events if e.event_type == "SAVE")
        enquiries = sum(1 for e in recent_events if e.event_type == "ENQUIRY")
        orders = sum(1 for e in recent_events if e.event_type == "ORDER")
        total_interactions = views + saves + enquiries + orders
        
        features = [
            mat_cost,
            lab_cost,
            pkg_cost,
            oth_cost,
            tot_cost,
            p_ratio,
            stock,
            cat_encoded,
            min(365, days_active),
            views,
            saves,
            enquiries,
            orders
        ]
        
        feature_dict = {
            "material_cost": mat_cost,
            "labour_cost": lab_cost,
            "packaging_cost": pkg_cost,
            "other_cost": oth_cost,
            "total_cost": tot_cost,
            "price_to_cost_ratio": p_ratio,
            "stock": stock,
            "category": getattr(product, "category", "Handcrafted"),
            "category_encoded": cat_encoded,
            "days_active": days_active,
            "total_interactions": total_interactions,
            "views": views,
            "saves": saves,
            "enquiries": enquiries,
            "orders": orders
        }
        
        return features, feature_dict


    def predict(self, product: Product, db: Session) -> Dict[str, Any]:
        """
        Runs RandomForestRegressor inference on product features with explicit cold-start guard.
        Differentiates between:
          1. INSUFFICIENT_HISTORY / COLD_START:
             days_active < 7 OR (days_active < 14 AND total_interactions < 5).
             Safely holds demand multiplier at 1.000x (neutral baseline) without unfair penalties.
          2. ESTABLISHED_LOW_DEMAND:
             Active listing (days_active >= 14 with 0 saves/orders).
             Real zero-demand signal; model predicts low demand score and bounded softening factor.
          3. ACTIVE_TELEMETRY:
             Active listing with conversion events; model predicts dynamic demand.

        Evidence-based confidence scale (based on total interaction sample size):
          - 0-9 interactions: LOW / INSUFFICIENT
          - 10-49 interactions: MEDIUM
          - 50+ interactions: HIGH
        """
        features, feature_dict = self.extract_features(product, db)
        days_active = feature_dict.get("days_active", 0)
        views = feature_dict.get("views", 0)
        saves = feature_dict.get("saves", 0)
        enquiries = feature_dict.get("enquiries", 0)
        orders = feature_dict.get("orders", 0)
        total_interactions = feature_dict.get("total_interactions", 0)

        metadata = self.metadata or {}
        training_mode = metadata.get("training_mode", "DOMAIN_INFORMED_BOOTSTRAP")
        is_real_mkt = bool(metadata.get("is_real_marketplace_data", False))
        training_source = metadata.get("training_data_source", "Domain-Informed Prior (Bootstrap Series)")
        
        model_info = {
            "available": self.is_available(),
            "model_name": metadata.get("model_name", "RandomForestRegressor"),
            "n_estimators": metadata.get("n_estimators", 100),
            "trained_at": metadata.get("trained_at"),
            "r2_score": metadata.get("r2_score"),
            "mae": metadata.get("mae"),
            "training_mode": training_mode,
            "training_data_source": training_source,
            "is_real_marketplace_data": is_real_mkt,
            "feature_importances": metadata.get("feature_importances", {}),
            "cold_start_policy": metadata.get("cold_start_policy", {
                "min_active_days": 7,
                "min_interactions": 5,
                "neutral_multiplier": 1.000
            })
        }

        # -----------------------------------------------------------------
        # COLD-START GUARD (Clean, non-redundant rule)
        # -----------------------------------------------------------------
        is_cold_start = (days_active < 7) or (days_active < 14 and total_interactions < 5)

        if is_cold_start:
            return {
                "product_id": product.id,
                "product_title": getattr(product, "title", f"Product #{product.id}"),
                "category": getattr(product, "category", "Handcrafted"),
                "current_price": float(getattr(product, "price", 0.0)),
                "predicted_demand_score": None,
                "demand_level": "COLD_START",
                "ml_demand_multiplier": 1.000,
                "is_cold_start": True,
                "telemetry_status": "COLD_START_INSUFFICIENT_HISTORY",
                "confidence": "COLD_START",
                "explanation": (
                    f"Newly published listing (active {days_active}d, {total_interactions} interactions). "
                    "Dynamic demand adjustment is safely held at neutral baseline (1.000x) until sufficient buyer telemetry accumulates."
                ),
                "features": feature_dict,
                "model_source": "COLD_START_NEUTRAL_BASELINE",
                "model_info": model_info
            }

        # -----------------------------------------------------------------
        # EVIDENCE-BASED CONFIDENCE SCALE
        # -----------------------------------------------------------------
        if total_interactions < 10:
            confidence = "LOW"
        elif total_interactions < 50:
            confidence = "MEDIUM"
        else:
            confidence = "HIGH"

        is_zero_conversion = (saves == 0 and enquiries == 0 and orders == 0)
        telemetry_status = "ESTABLISHED_LOW_DEMAND" if is_zero_conversion else "ACTIVE_TELEMETRY"

        model = self.model
        if model is None or not self.is_available():
            return {
                "product_id": product.id,
                "product_title": getattr(product, "title", f"Product #{product.id}"),
                "category": getattr(product, "category", "Handcrafted"),
                "current_price": float(getattr(product, "price", 0.0)),
                "predicted_demand_score": 0.0,
                "demand_level": "NORMAL",
                "ml_demand_multiplier": 1.000,
                "is_cold_start": False,
                "telemetry_status": telemetry_status,
                "confidence": confidence,
                "explanation": "Model artifacts unavailable; using neutral baseline.",
                "features": feature_dict,
                "model_source": "RULE_BASED_FALLBACK",
                "model_info": model_info
            }

        try:
            raw_prediction = float(model.predict([features])[0])
            score = max(0.0, min(100.0, round(raw_prediction, 2)))
            
            if score >= 45.0:
                level = "HIGH"
            elif score >= 20.0:
                level = "MODERATE"
            else:
                level = "LOW" if is_zero_conversion else "NORMAL"
                
            # Scale score into bounded demand factor [0.95, 1.15]
            multiplier = round(0.95 + (score / 100.0) * 0.20, 3)
            multiplier = max(0.95, min(1.15, multiplier))

            if is_zero_conversion:
                explanation = (
                    f"Product active for {days_active} days with {views} views and 0 conversions "
                    f"({confidence} confidence). Softening multiplier applied to stimulate buyer interest."
                )
            else:
                explanation = (
                    f"Active buyer engagement ({views} views, {saves} saves, {enquiries} enquiries, {orders} orders) "
                    f"over {days_active} days yields projected demand score {score:.0f}/100 ({confidence} confidence)."
                )

            return {
                "product_id": product.id,
                "product_title": getattr(product, "title", f"Product #{product.id}"),
                "category": getattr(product, "category", "Handcrafted"),
                "current_price": float(getattr(product, "price", 0.0)),
                "predicted_demand_score": score,
                "demand_level": level,
                "ml_demand_multiplier": multiplier,
                "is_cold_start": False,
                "telemetry_status": telemetry_status,
                "confidence": confidence,
                "explanation": explanation,
                "features": feature_dict,
                "model_source": "TRAINED_ML_MODEL",
                "model_info": model_info
            }
        except Exception as e:
            logger.error("ML Inference error for product ID %s: %s", product.id, e)
            return {
                "product_id": product.id,
                "product_title": getattr(product, "title", f"Product #{product.id}"),
                "category": getattr(product, "category", "Handcrafted"),
                "current_price": float(getattr(product, "price", 0.0)),
                "predicted_demand_score": 0.0,
                "demand_level": "NORMAL",
                "ml_demand_multiplier": 1.000,
                "is_cold_start": False,
                "telemetry_status": telemetry_status,
                "confidence": "FALLBACK",
                "explanation": f"Inference exception: {str(e)}",
                "features": feature_dict,
                "model_source": "RULE_BASED_FALLBACK",
                "model_info": model_info
            }

def predict_product_demand(product: Product, db: Session) -> Dict[str, Any]:
    engine = MLDemandEngine()
    return engine.predict(product, db)
