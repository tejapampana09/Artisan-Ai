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
        
        # Real buyer engagement counts from events table
        views = db.query(Event).filter(Event.product_id == product.id, Event.event_type == "VIEW").count()
        saves = db.query(Event).filter(Event.product_id == product.id, Event.event_type == "SAVE").count()
        enquiries = db.query(Event).filter(Event.product_id == product.id, Event.event_type == "ENQUIRY").count()
        orders = db.query(Event).filter(Event.product_id == product.id, Event.event_type == "ORDER").count()
        
        features = [
            mat_cost,
            lab_cost,
            pkg_cost,
            oth_cost,
            tot_cost,
            p_ratio,
            stock,
            cat_encoded,
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
            "views": views,
            "saves": saves,
            "enquiries": enquiries,
            "orders": orders
        }
        
        return features, feature_dict

    def predict(self, product: Product, db: Session) -> Dict[str, Any]:
        """
        Runs RandomForestRegressor inference on product features.
        Returns predicted demand score (0-100), level, ML demand multiplier (0.95-1.15), and model metadata.
        """
        features, feature_dict = self.extract_features(product, db)
        
        if not self.is_available():
            # Graceful Fallback if model not loaded
            return {
                "product_id": product.id,
                "predicted_demand_score": 0.0,
                "demand_level": "NORMAL",
                "ml_demand_multiplier": 1.00,
                "features": feature_dict,
                "model_source": "RULE_BASED_FALLBACK",
                "model_info": {
                    "available": False,
                    "reason": "Model artifacts not initialized"
                }
            }

        model = self.model
        metadata = self.metadata
        if model is None or metadata is None:
            return {
                "product_id": product.id,
                "predicted_demand_score": 0.0,
                "demand_level": "NORMAL",
                "ml_demand_multiplier": 1.00,
                "features": feature_dict,
                "model_source": "RULE_BASED_FALLBACK",
                "model_info": {
                    "available": False,
                    "reason": "Model artifacts are unavailable"
                }
            }

        try:
            raw_prediction = float(model.predict([features])[0])
            score = max(0.0, min(100.0, round(raw_prediction, 2)))
            
            if score >= 45.0:
                level = "HIGH"
            elif score >= 20.0:
                level = "MODERATE"
            else:
                level = "NORMAL"
                
            # Scale score into bounded demand factor [0.95, 1.15]
            multiplier = round(0.95 + (score / 100.0) * 0.20, 3)
            multiplier = max(0.95, min(1.15, multiplier))
            
            return {
                "product_id": product.id,
                "predicted_demand_score": score,
                "demand_level": level,
                "ml_demand_multiplier": multiplier,
                "features": feature_dict,
                "model_source": "TRAINED_ML_MODEL",
                "model_info": {
                    "available": True,
                    "model_name": metadata.get("model_name"),
                    "n_estimators": metadata.get("n_estimators"),
                    "trained_at": metadata.get("trained_at"),
                    "r2_score": metadata.get("r2_score"),
                    "mae": metadata.get("mae"),
                    "training_mode": metadata.get("training_mode"),
                    "feature_importances": metadata.get("feature_importances", {})
                }
            }
        except Exception as e:
            logger.error("ML Inference error for product ID %s: %s", product.id, e)
            return {
                "product_id": product.id,
                "predicted_demand_score": 0.0,
                "demand_level": "NORMAL",
                "ml_demand_multiplier": 1.00,
                "features": feature_dict,
                "model_source": "RULE_BASED_FALLBACK",
                "model_info": {
                    "available": False,
                    "reason": f"Inference exception: {str(e)}"
                }
            }

def predict_product_demand(product: Product, db: Session) -> Dict[str, Any]:
    engine = MLDemandEngine()
    return engine.predict(product, db)
