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

from sqlalchemy import event

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if is_sqlite:
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=10000")
            cursor.close()
        except Exception as pragma_err:
            logger.warning("[Database] SQLite PRAGMA configuration skipped: %s", pragma_err)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema_migrations(engine):
    """Ensure schema_migrations table exists and verify columns."""
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if not inspector.has_table("schema_migrations"):
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE schema_migrations (
                    version VARCHAR(255) PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()

    # Safe migration for new User location & craft cluster columns
    if inspector.has_table("users"):
        user_cols = {col["name"] for col in inspector.get_columns("users")}
        new_columns = [
            ("latitude", "NUMERIC(9,6)"),
            ("longitude", "NUMERIC(9,6)"),
            ("craft_cluster", "VARCHAR(100)"),
            ("state", "VARCHAR(100)"),
            ("district", "VARCHAR(100)"),
            ("pincode", "VARCHAR(20)")
        ]
        with engine.connect() as conn:
            for col_name, col_type in new_columns:
                if col_name not in user_cols:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
            conn.commit()

