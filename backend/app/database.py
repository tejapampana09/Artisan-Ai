import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import DATABASE_URL, ENVIRONMENT

logger = logging.getLogger("artisan_ai.database")

def build_engine(url: str):
    if url.startswith("sqlite"):
        return create_engine(
            url,
            connect_args={"check_same_thread": False}
        )
    # Production-hardened connection pool for PostgreSQL
    return create_engine(
        url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=300
    )

def init_engine(url: str):
    if url.startswith("sqlite"):
        return build_engine(url)

    try_engine = build_engine(url)
    # In non-production, test connection. If local firewall/network blocks port 5432, fallback to SQLite
    if ENVIRONMENT != "production":
        try:
            with try_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception as e:
            logger.warning(
                f"[Database] Remote PostgreSQL connection failed ({e}). "
                "Local network/firewall may be blocking port 5432. "
                "Falling back to local SQLite (artisan_ai.db) for uninterrupted demo and development."
            )
            return build_engine("sqlite:///./artisan_ai.db")

    return try_engine

engine = init_engine(DATABASE_URL)
is_sqlite = engine.url.drivername.startswith("sqlite")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def ensure_sqlite_schema(eng):
    if not eng.url.drivername.startswith("sqlite"):
        return
    with eng.connect() as conn:
        # Check users table columns
        res = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        user_cols = [row[1] for row in res]
        if user_cols:
            if "avatar_url" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url TEXT"))
            if "bio" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN bio TEXT"))
            if "craft_specialization" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN craft_specialization VARCHAR"))
            if "experience_years" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN experience_years INTEGER DEFAULT 0"))
            if "verification_status" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN verification_status VARCHAR DEFAULT 'UNVERIFIED'"))

        # Check products table columns
        res_prod = conn.execute(text("PRAGMA table_info(products)")).fetchall()
        prod_cols = [row[1] for row in res_prod]
        if prod_cols:
            if "craft_process" not in prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN craft_process TEXT"))
            if "region_of_origin" not in prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN region_of_origin VARCHAR"))
            if "handmade_pct" not in prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN handmade_pct INTEGER DEFAULT 100"))
            if "production_time_days" not in prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN production_time_days INTEGER DEFAULT 3"))
            if "secondary_images" not in prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN secondary_images TEXT"))
            if "verification_status" not in prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN verification_status VARCHAR DEFAULT 'UNVERIFIED'"))
            if "other_cost" not in prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN other_cost NUMERIC(12, 2) DEFAULT 0.00"))
            if "auto_smart_pricing_enabled" not in prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN auto_smart_pricing_enabled BOOLEAN DEFAULT 0"))
            if "title_en" not in prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN title_en VARCHAR"))
            if "description_en" not in prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN description_en TEXT"))
            if "craft_story_en" not in prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN craft_story_en TEXT"))
            if "translations" not in prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN translations TEXT"))


        # Check orders table columns
        res_ord = conn.execute(text("PRAGMA table_info(orders)")).fetchall()
        ord_cols = [row[1] for row in res_ord]
        if ord_cols:
            if "cancellation_status" not in ord_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN cancellation_status VARCHAR DEFAULT 'NONE'"))
            if "cancellation_reason" not in ord_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN cancellation_reason TEXT"))
            if "tracking_history" not in ord_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN tracking_history TEXT"))

        conn.commit()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
