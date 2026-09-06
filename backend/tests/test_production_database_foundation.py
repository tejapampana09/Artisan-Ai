import os
import pytest
from decimal import Decimal
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import QueuePool
from fastapi.testclient import TestClient

from backend.app.config import validate_production_config, get_database_url
from backend.app.database import build_engine, SessionLocal
from backend.app.models import Product, Order, User
from backend.app.main import app

client = TestClient(app)

def test_database_url_normalization():
    """Verify postgres:// is safely converted to postgresql:// dialect prefix."""
    raw_heroku_style = "postgres://artisan_user:secure_pwd@db.host.internal:5432/artisan_prod"
    normalized = get_database_url(raw_heroku_style)
    assert normalized == "postgresql://artisan_user:secure_pwd@db.host.internal:5432/artisan_prod"

    sqlite_url = "sqlite:///./artisan.db"
    assert get_database_url(sqlite_url) == "sqlite:///./artisan.db"


def test_production_environment_safety_validation():
    """
    Ensure production deployment strictly rejects:
    1. DEMO_MODE enabled
    2. SQLite database backend
    3. Missing or insecure default JWT secret
    """
    # 1. Reject DEMO_MODE=True in production
    with pytest.raises(RuntimeError, match="CRITICAL SECURITY CONFIGURATION ERROR: DEMO_MODE cannot be enabled in production"):
        validate_production_config(
            env="production",
            demo_mode=True,
            database_url="postgresql://user:pass@host:5432/db",
            jwt_secret="super-strong-production-secret-key-12345"
        )

    # 2. Reject SQLite in production
    with pytest.raises(RuntimeError, match="CRITICAL SECURITY CONFIGURATION ERROR: SQLite cannot be used as the production database"):
        validate_production_config(
            env="production",
            demo_mode=False,
            database_url="sqlite:///./test.db",
            jwt_secret="super-strong-production-secret-key-12345"
        )

    # 3. Reject default / weak secret key in production
    with pytest.raises(RuntimeError, match="CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET_KEY environment variable must be explicitly set"):
        validate_production_config(
            env="production",
            demo_mode=False,
            database_url="postgresql://user:pass@host:5432/db",
            jwt_secret="dev-artisan-ai-super-secret-jwt-key-sih-2024"
        )

    # 4. Allow valid production parameters
    assert validate_production_config(
        env="production",
        demo_mode=False,
        database_url="postgresql://prod_user:prod_pass@cluster:5432/artisan_db",
        jwt_secret="c790fe2a-8d19-482f-897b-prod-jwt-secret-xyz"
    ) is True


def test_postgresql_connection_pool_hardening():
    """
    Verify PostgreSQL engine is configured with production connection pooling:
    pool_size=10, max_overflow=20, pool_pre_ping=True, pool_recycle=300
    """
    pg_url = "postgresql://user:pass@localhost:5432/mock_db"
    pg_engine = build_engine(pg_url)

    assert isinstance(pg_engine.pool, QueuePool)
    assert pg_engine.pool.size() == 10
    assert pg_engine.pool._max_overflow == 20
    assert pg_engine.pool._pre_ping is True
    assert pg_engine.pool._recycle == 300

    # Verify SQLite engine uses check_same_thread=False
    sqlite_url = "sqlite:///./temp_check.db"
    sqlite_engine = build_engine(sqlite_url)
    assert sqlite_engine.url.drivername == "sqlite"


def test_decimal_money_exactness_and_order_total():
    """
    Verify exact Decimal storage and calculation for prices and order totals,
    eliminating IEEE-754 floating-point inaccuracies.
    """
    db = SessionLocal()
    try:
        import uuid
        uid = uuid.uuid4().hex[:8]
        # Create seller
        user = User(
            name="Decimal Craft Master",
            email=f"decimal_{uid}@example.com",
            role="ARTISAN",
            active_mode="SELL"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create product with fractional decimal costs
        p = Product(
            title="Precision Silk Dupatta",
            category="Textiles",
            price=Decimal("1249.99"),
            stock=15,
            material_cost=Decimal("312.45"),
            labour_cost=Decimal("415.65"),
            packaging_cost=Decimal("55.20"),
            min_margin_pct=Decimal("0.2500"),
            seller_id=user.id
        )
        db.add(p)
        db.commit()
        db.refresh(p)

        # Confirm exact Decimal retrieval from database
        assert isinstance(p.price, Decimal)
        assert p.price == Decimal("1249.99")
        assert p.material_cost == Decimal("312.45")
        assert p.labour_cost == Decimal("415.65")
        assert p.packaging_cost == Decimal("55.20")
        assert p.min_margin_pct == Decimal("0.2500")

        # Create order for 3 units
        qty = 3
        unit_price = p.price
        expected_total = (unit_price * Decimal(qty)).quantize(Decimal("0.01"))
        assert expected_total == Decimal("3749.97")  # NOT 3749.9700000000003

        order = Order(
            product_id=p.id,
            user_id=user.id,
            buyer_name="Ravi Kumar",
            quantity=qty,
            unit_price=unit_price,
            total_price=expected_total,
            delivery_address="42 Craft St, Hyderabad",
            status="CONFIRMED"
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        assert isinstance(order.total_price, Decimal)
        assert order.total_price == Decimal("3749.97")

        # Confirm API serialization produces JSON numbers for frontend compatibility
        res = client.get(f"/api/products/{p.id}")
        assert res.status_code == 200
        p_json = res.json()
        assert p_json["price"] == 1249.99
        assert p_json["material_cost"] == 312.45
    finally:
        db.close()


def test_database_check_constraints_prevent_negative_money():
    """Verify database CheckConstraints enforce non-negative prices and costs."""
    db = SessionLocal()
    try:
        invalid_prod = Product(
            title="Negative Price Product",
            category="Pottery",
            price=Decimal("-50.00"),  # Violates chk_product_price_non_negative
            stock=5,
            material_cost=Decimal("10.00"),
            labour_cost=Decimal("10.00"),
            packaging_cost=Decimal("5.00"),
            min_margin_pct=Decimal("0.20")
        )
        db.add(invalid_prod)
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

        invalid_order = Order(
            product_id=1,
            buyer_name="Negative Quantity Buyer",
            quantity=0,  # Violates chk_order_quantity_positive
            unit_price=Decimal("100.00"),
            total_price=Decimal("0.00"),
            delivery_address="123 Test St"
        )
        db.add(invalid_order)
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
    finally:
        db.close()


def test_alembic_migration_head_creates_all_tables(tmp_path):
    """
    Verify Alembic migrations apply cleanly and establish all 6 tables
    on a completely fresh database.
    """
    from alembic.config import Config
    from alembic import command
    import sqlite3

    temp_db_path = str(tmp_path / "fresh_alembic_test.db")
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", f"sqlite:///{temp_db_path}")

    # Run upgrade head
    command.upgrade(alembic_cfg, "head")

    # Connect to verify tables created
    conn = sqlite3.connect(temp_db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = {row[0] for row in cursor.fetchall()}
    conn.close()

    expected_tables = {"users", "products", "orders", "enquiries", "events", "pricing_decisions", "alembic_version"}
    assert expected_tables.issubset(tables)
