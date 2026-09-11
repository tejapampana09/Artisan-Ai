import os
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.models import Product, User, Event
from backend.app.services.ml_demand_engine import MLDemandEngine, predict_product_demand
from backend.app.services.pricing_engine import calculate_price_recommendation
from backend.ml.train_demand_model import train_and_save_model
from backend.tests.conftest import TestingSessionLocal, test_engine

client = TestClient(app)

def test_ml_model_training_and_artifacts():
    metadata = train_and_save_model()
    assert metadata["model_name"] == "RandomForestRegressor"
    assert "r2_score" in metadata
    assert isinstance(metadata["r2_score"], float)
    assert "mae" in metadata
    assert "feature_importances" in metadata
    assert len(metadata["feature_importances"]) == 12
    assert metadata["training_mode"] == "DOMAIN_INFORMED_SYNTHETIC_PROTOTYPE"

def test_ml_demand_engine_prediction():
    db = TestingSessionLocal()
    try:
        artisan = User(
            name="ML Tester",
            email="ml_tester@example.com",
            hashed_password="hashed_pw",
            role="ARTISAN"
        )
        db.add(artisan)
        db.commit()
        db.refresh(artisan)

        product = Product(
            title="Handcrafted Kalamkari Saree",
            category="Kalamkari",
            price=3500.0,
            stock=10,
            material_cost=1500.0,
            labour_cost=800.0,
            packaging_cost=100.0,
            other_cost=0.0,
            seller_id=artisan.id,
            status="PUBLISHED"
        )
        db.add(product)
        db.commit()
        db.refresh(product)

        # Add buyer interaction events
        for _ in range(5):
            db.add(Event(product_id=product.id, category="Kalamkari", event_type="VIEW"))
        for _ in range(3):
            db.add(Event(product_id=product.id, category="Kalamkari", event_type="SAVE"))
        for _ in range(2):
            db.add(Event(product_id=product.id, category="Kalamkari", event_type="ENQUIRY"))
        db.commit()

        prediction = predict_product_demand(product, db)
        assert prediction["product_id"] == product.id
        assert "predicted_demand_score" in prediction
        assert 0.0 <= prediction["predicted_demand_score"] <= 100.0
        assert prediction["demand_level"] in ["HIGH", "MODERATE", "NORMAL"]
        assert 0.95 <= prediction["ml_demand_multiplier"] <= 1.15
        assert prediction["model_source"] == "TRAINED_ML_MODEL"
        assert prediction["model_info"]["available"] is True
    finally:
        db.close()

def test_ml_demand_engine_fallback_when_missing():
    db = TestingSessionLocal()
    try:
        engine = MLDemandEngine()
        original_model = engine.model
        try:
            artisan = db.query(User).first()
            product = Product(
                title="Fallback Craft",
                category="Wooden Toys",
                price=500.0,
                stock=5,
                material_cost=200.0,
                labour_cost=100.0,
                packaging_cost=20.0,
                seller_id=artisan.id if artisan else 1
            )
            db.add(product)
            db.commit()
            db.refresh(product)

            # Simulate missing model
            engine.model = None
            prediction = engine.predict(product, db)
            assert prediction["model_source"] == "RULE_BASED_FALLBACK"
            assert prediction["predicted_demand_score"] == 0.0
            assert prediction["ml_demand_multiplier"] == 1.00
        finally:
            engine.model = original_model
    finally:
        db.close()

def test_ml_pricing_recommendation_integration():
    db = TestingSessionLocal()
    try:
        artisan = User(
            name="Pricing Tester",
            email="pricing_tester@example.com",
            hashed_password="hashed_pw",
            role="ARTISAN"
        )
        db.add(artisan)
        db.commit()
        db.refresh(artisan)

        product = Product(
            title="Bidriware Craft Bowl",
            category="Bidriware",
            price=2000.0,
            stock=4,
            material_cost=800.0,
            labour_cost=500.0,
            packaging_cost=50.0,
            other_cost=50.0,
            seller_id=artisan.id,
            status="PUBLISHED"
        )
        db.add(product)
        db.commit()
        db.refresh(product)

        rec = calculate_price_recommendation(product, db)
        assert "recommended_price" in rec
        # Minimum fair price = (800 + 500 + 50 + 50) * 1.20 = 1400 * 1.20 = 1680.0
        assert rec["minimum_fair_price"] == 1680.0
        assert rec["recommended_price"] >= rec["minimum_fair_price"]
        
        reasoning_str = " ".join(rec["reasoning"])
        assert "RandomForestRegressor" in reasoning_str or "Bidriware market demand" in reasoning_str
    finally:
        db.close()

def test_ml_api_endpoints():
    # 1. GET /api/ml/model-info
    res_info = client.get("/api/ml/model-info")
    assert res_info.status_code == 200
    info_data = res_info.json()
    assert info_data["is_available"] is True
    assert info_data["metadata"]["model_name"] == "RandomForestRegressor"

    # 2. POST /api/ml/predict-demand
    payload = {
        "material_cost": 1200.0,
        "labour_cost": 600.0,
        "packaging_cost": 80.0,
        "stock": 15,
        "category": "Pochampally Ikat",
        "price": 2800.0
    }
    res_pred = client.post("/api/ml/predict-demand", json=payload)
    assert res_pred.status_code == 200
    pred_data = res_pred.json()
    assert "predicted_demand_score" in pred_data
    assert 0.0 <= pred_data["predicted_demand_score"] <= 100.0
    assert pred_data["model_source"] in ["TRAINED_ML_MODEL", "RULE_BASED_FALLBACK"]

def test_ml_retrain_endpoint_threshold_protection():
    # Register artisan & login to get JWT auth header
    reg_res = client.post("/api/auth/register", json={
        "name": "Admin Retrainer",
        "email": "retrainer@example.com",
        "phone": "+919876543210",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Call /api/ml/retrain without reaching minimum event threshold (< 20 events)
    res_retrain = client.post("/api/ml/retrain", headers=headers)
    assert res_retrain.status_code == 400
    detail = res_retrain.json()["detail"]
    assert "Production retraining requires at least 20 real buyer interaction events" in detail
