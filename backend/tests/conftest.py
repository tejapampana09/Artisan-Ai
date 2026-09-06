import os
import sys
from pathlib import Path
import pytest

REPO_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from sqlalchemy.orm import sessionmaker

TEST_DB_URL = "sqlite:///./test_runner.db"
os.environ["DATABASE_URL"] = TEST_DB_URL

from backend.app.database import Base, build_engine, get_db
import backend.app.database as db_module
from backend.app.main import app

# Re-bind database module to isolated test database
test_engine = build_engine(TEST_DB_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

db_module.engine = test_engine
db_module.SessionLocal = TestingSessionLocal

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
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    yield

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()
    if os.path.exists("./test_runner.db"):
        try:
            os.remove("./test_runner.db")
        except OSError:
            pass
