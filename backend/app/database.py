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

def auto_migrate_sqlite_schema(target_engine):
    if not target_engine.url.drivername.startswith("sqlite"):
        return
    try:
        from sqlalchemy import inspect
        insp = inspect(target_engine)
        if "users" in insp.get_table_names():
            cols = [c["name"] for c in insp.get_columns("users")]
            if "token_version" not in cols:
                with target_engine.connect() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1"))
                    conn.commit()
                logger.info("[Database Auto-Migrate] Added token_version column to users table.")
    except Exception as e:
        logger.warning(f"[Database Auto-Migrate] SQLite migration check skipped: {e}")

engine = init_engine(DATABASE_URL)
auto_migrate_sqlite_schema(engine)
is_sqlite = engine.url.drivername.startswith("sqlite")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
