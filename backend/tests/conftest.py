import os
import sys
from pathlib import Path
import pytest

REPO_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

TEST_DB_URL = "sqlite:///:memory:"
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["DEMO_MODE"] = "true"

from backend.app.database import Base, get_db
import backend.app.database as db_module

# Isolated in-memory SQLite engine with StaticPool for fast, 100% clean test execution
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

db_module.engine = test_engine
db_module.SessionLocal = TestingSessionLocal

from backend.app.main import app

@pytest.fixture(scope="function", autouse=True)
def setup_test_database():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    
    from backend.app.models import User
    from backend.app.seed import seed_sample_products
    with TestingSessionLocal() as session:
        user = User(
            name="Lakshmi Devi",
            email="lakshmi@artisanai.in",
            role="ARTISAN",
            active_mode="SELL",
            location="Machilipatnam, Andhra Pradesh",
            craft="Hand-block Kalamkari"
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        seed_sample_products(session, user.id)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    yield

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)
