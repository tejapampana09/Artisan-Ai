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
