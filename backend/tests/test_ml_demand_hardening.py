import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

from backend.app.models import Product, Event, User
from backend.app.services.ml_demand_engine import MLDemandEngine, predict_product_demand
from backend.ml.train_demand_model import extract_db_dataset, MIN_ACTIVE_DAYS_FOR_SNAPSHOT

def test_ml_cold_start_newly_published_product_is_safe_neutral(db: Session):
    now = datetime.now(timezone.utc)
    prod = Product(
        title="Fresh Kalamkari Dupatta",
        category="Kalamkari",
        price=Decimal("1200.00"),
        material_cost=Decimal("400.00"),
        labour_cost=Decimal("300.00"),
        packaging_cost=Decimal("50.00"),
        other_cost=Decimal("50.00"),
        stock=10,
        status="PUBLISHED",
        published_at=now - timedelta(days=2),
        created_at=now - timedelta(days=2)
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)

    db.add(Event(product_id=prod.id, event_type="VIEW", timestamp=now - timedelta(hours=5)))
    db.commit()

    engine = MLDemandEngine()
    result = engine.predict(prod, db)

    assert result["is_cold_start"] is True
    assert result["predicted_demand_score"] is None
    assert result["ml_demand_multiplier"] == 1.000
    assert result["demand_level"] == "COLD_START"
    assert result["confidence"] == "COLD_START"
    assert result["telemetry_status"] == "COLD_START_INSUFFICIENT_HISTORY"
    assert result["model_info"]["is_real_marketplace_data"] is False
    assert result["model_info"]["training_mode"] == "DOMAIN_INFORMED_BOOTSTRAP"

def test_ml_cold_start_under_14_days_with_low_interactions(db: Session):
    now = datetime.now(timezone.utc)
    prod = Product(
        title="Infant Wooden Elephant",
        category="Wooden Toys",
        price=Decimal("800.00"),
        material_cost=Decimal("200.00"),
        labour_cost=Decimal("250.00"),
        stock=5,
        status="PUBLISHED",
        published_at=now - timedelta(days=10),
        created_at=now - timedelta(days=10)
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)

    for h in [20, 40, 60]:
        db.add(Event(product_id=prod.id, event_type="VIEW", timestamp=now - timedelta(hours=h)))
    db.commit()

    engine = MLDemandEngine()
    result = engine.predict(prod, db)

    assert result["is_cold_start"] is True
    assert result["ml_demand_multiplier"] == 1.000
    assert result["telemetry_status"] == "COLD_START_INSUFFICIENT_HISTORY"

def test_ml_established_low_demand_has_low_confidence_when_under_10_interactions(db: Session):
    now = datetime.now(timezone.utc)
    prod = Product(
        title="Unpopular Clay Vase",
        category="Blue Pottery",
        price=Decimal("1500.00"),
        material_cost=Decimal("500.00"),
        labour_cost=Decimal("400.00"),
        stock=12,
        status="PUBLISHED",
        published_at=now - timedelta(days=20),
        created_at=now - timedelta(days=20)
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)

    for i in range(6):
        db.add(Event(product_id=prod.id, event_type="VIEW", timestamp=now - timedelta(days=i + 1)))
    db.commit()

    engine = MLDemandEngine()
    result = engine.predict(prod, db)

    assert result["is_cold_start"] is False
    assert result["telemetry_status"] == "ESTABLISHED_LOW_DEMAND"
    assert result["confidence"] == "LOW"
    assert result["predicted_demand_score"] is not None
    assert result["ml_demand_multiplier"] <= 1.000

def test_ml_evidence_based_confidence_medium_and_high(db: Session):
    now = datetime.now(timezone.utc)
    prod_med = Product(
        title="Ikat Cotton Kurta",
        category="Handloom",
        price=Decimal("1800.00"),
        material_cost=Decimal("600.00"),
        labour_cost=Decimal("500.00"),
        stock=8,
        status="PUBLISHED",
        published_at=now - timedelta(days=25),
        created_at=now - timedelta(days=25)
    )
    db.add(prod_med)
    db.commit()
    db.refresh(prod_med)

    for i in range(20):
        db.add(Event(product_id=prod_med.id, event_type="VIEW", timestamp=now - timedelta(days=i % 15 + 1)))
    for i in range(5):
        db.add(Event(product_id=prod_med.id, event_type="SAVE", timestamp=now - timedelta(days=i + 1)))
    db.commit()

    engine = MLDemandEngine()
    res_med = engine.predict(prod_med, db)
    assert res_med["is_cold_start"] is False
    assert res_med["confidence"] == "MEDIUM"

    prod_hi = Product(
        title="Bidriware Silver Box",
        category="Bidriware",
        price=Decimal("3200.00"),
        material_cost=Decimal("1200.00"),
        labour_cost=Decimal("1000.00"),
        stock=4,
        status="PUBLISHED",
        published_at=now - timedelta(days=35),
        created_at=now - timedelta(days=35)
    )
    db.add(prod_hi)
    db.commit()
    db.refresh(prod_hi)

    for i in range(45):
        db.add(Event(product_id=prod_hi.id, event_type="VIEW", timestamp=now - timedelta(days=i % 25 + 1)))
    for i in range(6):
        db.add(Event(product_id=prod_hi.id, event_type="SAVE", timestamp=now - timedelta(days=i + 1)))
    for i in range(4):
        db.add(Event(product_id=prod_hi.id, event_type="ORDER", timestamp=now - timedelta(days=i + 1)))
    db.commit()

    res_hi = engine.predict(prod_hi, db)
    assert res_hi["is_cold_start"] is False
    assert res_hi["confidence"] == "HIGH"
    assert res_hi["predicted_demand_score"] > 20.0

def test_ml_db_dataset_extraction_constants():
    assert MIN_ACTIVE_DAYS_FOR_SNAPSHOT == 7

def test_temporal_cv_and_forecast_gap_metadata():
    import json
    import os
    meta_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml", "model_meta.json")
    assert os.path.exists(meta_path)
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    
    assert meta["evaluation_protocol"] == "TEMPORAL_TIMESERIESSPLIT_WITH_7D_FORECAST_GAP"
    assert meta["evaluation_scope"] == "TEMPORAL_HOLDOUT_ON_ESTABLISHED_PRODUCTS"
    assert meta["forecast_horizon_gap_steps"] == 1
    assert "temporal_cv_r2_mean" in meta
    assert len(meta["feature_names"]) == 13
    assert "days_active" in meta["feature_names"]
    assert meta["target_horizon"] == "7_DAYS_FORWARD"

def test_retrain_endpoint_requires_admin_authorization(client, artisan_headers, admin_headers):
    # 1. Unauthenticated -> 401
    res_unauth = client.post("/api/ml/retrain")
    assert res_unauth.status_code == 401

    # 2. Artisan -> 403 Forbidden
    res_artisan = client.post("/api/ml/retrain", headers=artisan_headers)
    assert res_artisan.status_code == 403

    # 3. Buyer -> 403 Forbidden
    from backend.tests.conftest import make_buyer
    _, _, _, buyer_headers = make_buyer(client)
    res_buyer = client.post("/api/ml/retrain", headers=buyer_headers)
    assert res_buyer.status_code == 403

    # 4. Admin -> Reaches retraining operation, rejected with 400 because threshold not met
    res_admin = client.post("/api/ml/retrain", headers=admin_headers)
    assert res_admin.status_code == 400
    assert "Production retraining requires at least" in res_admin.json()["detail"]


def test_extract_db_dataset_product_created_after_snapshot_is_excluded(db: Session):
    now = datetime.now(timezone.utc)
    anchor_prod = Product(
        title="Anchor Product",
        category="Kalamkari",
        price=Decimal("1000.00"),
        material_cost=Decimal("300.00"),
        stock=5,
        status="PUBLISHED",
        created_at=now - timedelta(days=25),
        published_at=now - timedelta(days=25)
    )
    db.add(anchor_prod)
    db.commit()

    db.add(Event(product_id=anchor_prod.id, event_type="VIEW", timestamp=now - timedelta(days=20)))
    db.add(Event(product_id=anchor_prod.id, event_type="ORDER", timestamp=now - timedelta(days=1)))
    db.commit()

    late_prod = Product(
        title="Late Created Product",
        category="Wooden Toys",
        price=Decimal("500.00"),
        material_cost=Decimal("150.00"),
        stock=3,
        status="PUBLISHED",
        created_at=now - timedelta(days=2),
        published_at=now - timedelta(days=2)
    )
    db.add(late_prod)
    db.commit()

    X, y, ts, features, count = extract_db_dataset(db, min_products=1, min_events=2, min_days=14)
    assert count >= 1
    categories = [r[7] for r in X]  # category_encoded is index 7
    assert all(cat == 0 for cat in categories), "Late product created after T must not appear in snapshot"


def test_extract_db_dataset_excludes_products_with_under_7_days_active(db: Session):
    now = datetime.now(timezone.utc)
    prod = Product(
        title="Young Product",
        category="Bidriware",
        price=Decimal("2000.00"),
        material_cost=Decimal("700.00"),
        stock=2,
        status="PUBLISHED",
        created_at=now - timedelta(days=8),
        published_at=now - timedelta(days=8)
    )
    db.add(prod)
    db.commit()

    db.add(Event(product_id=prod.id, event_type="VIEW", timestamp=now - timedelta(days=25)))
    db.add(Event(product_id=prod.id, event_type="VIEW", timestamp=now - timedelta(days=1)))
    db.commit()

    X, y, ts, features, count = extract_db_dataset(db, min_products=1, min_events=2, min_days=14)
    assert count == 0, "Products with < 7 days active exposure must be excluded from training"


def test_events_telemetry_isolation_admin_artisan_buyer(client, db: Session, admin_headers, artisan_headers):
    # 1. Buyer is forbidden from querying GET /api/events
    from backend.tests.conftest import make_buyer
    _, _, _, buyer_headers = make_buyer(client)
    res_buyer = client.get("/api/events", headers=buyer_headers)
    assert res_buyer.status_code == 403
    assert "Buyers and unprivileged users are not authorized" in res_buyer.json()["detail"]

    # 2. Artisan can query, but only sees their own products
    artisan_prod = db.query(Product).filter(Product.seller_id != None).first()
    assert artisan_prod is not None

    db.add(Event(product_id=artisan_prod.id, event_type="VIEW", timestamp=datetime.now(timezone.utc)))
    other_prod = Product(
        title="Unrelated Artisan Vase",
        category="Blue Pottery",
        price=Decimal("1500.00"),
        material_cost=Decimal("500.00"),
        stock=5,
        status="PUBLISHED",
        seller_id=99999,
        created_at=datetime.now(timezone.utc)
    )
    db.add(other_prod)
    db.commit()
    db.refresh(other_prod)
    db.add(Event(product_id=other_prod.id, event_type="VIEW", timestamp=datetime.now(timezone.utc)))
    db.commit()

    res_art = client.get("/api/events", headers=artisan_headers)
    assert res_art.status_code == 200
    events_data = res_art.json()
    assert all(e["product_id"] != other_prod.id for e in events_data)

    res_art_forbidden = client.get(f"/api/events?product_id={other_prod.id}", headers=artisan_headers)
    assert res_art_forbidden.status_code == 403

    res_admin = client.get(f"/api/events?product_id={other_prod.id}", headers=admin_headers)
    assert res_admin.status_code == 200
    assert len(res_admin.json()) >= 1


def test_predict_demand_scoped_authorization_isolation(client, db: Session, admin_headers, artisan_headers):
    # 1. Unauthenticated request -> 401 Unauthorized
    artisan_prod = db.query(Product).filter(Product.seller_id != None).first()
    assert artisan_prod is not None

    res_unauth = client.get(f"/api/ml/predict-demand/{artisan_prod.id}")
    assert res_unauth.status_code == 401

    # 2. Buyer request -> 403 Forbidden
    from backend.tests.conftest import make_buyer
    _, _, _, buyer_headers = make_buyer(client)
    res_buyer = client.get(f"/api/ml/predict-demand/{artisan_prod.id}", headers=buyer_headers)
    assert res_buyer.status_code == 403
    assert "restricted to the owning artisan or administrator" in res_buyer.json()["detail"]

    # 3. Another artisan's product -> 403 Forbidden
    foreign_prod = Product(
        title="Foreign Artisan Silk Saree",
        category="Pochampally Ikat",
        price=Decimal("4500.00"),
        material_cost=Decimal("1500.00"),
        stock=3,
        status="PUBLISHED",
        seller_id=99999,
        created_at=datetime.now(timezone.utc)
    )
    db.add(foreign_prod)
    db.commit()
    db.refresh(foreign_prod)

    res_cross = client.get(f"/api/ml/predict-demand/{foreign_prod.id}", headers=artisan_headers)
    assert res_cross.status_code == 403
    assert "do not have permission to view demand telemetry" in res_cross.json()["detail"]

    # 4. Owning artisan -> 200 OK
    res_owner = client.get(f"/api/ml/predict-demand/{artisan_prod.id}", headers=artisan_headers)
    assert res_owner.status_code == 200
    assert "predicted_demand_score" in res_owner.json() or "ml_demand_multiplier" in res_owner.json()

    # 5. Admin request for any product -> 200 OK
    res_admin = client.get(f"/api/ml/predict-demand/{foreign_prod.id}", headers=admin_headers)
    assert res_admin.status_code == 200
    assert "ml_demand_multiplier" in res_admin.json()

