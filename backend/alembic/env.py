"""
Alembic migration environment.

Auto-detects DATABASE_URL from the environment:
  - Production / CI:  DATABASE_URL = postgresql://... (set via GitHub Secret or AWS env)
  - Local dev:        DATABASE_URL = sqlite:///./artisan_ai.db (default fallback)

For PostgreSQL (RDS), NullPool is used so the migration runner does not hold
open idle connections after `alembic upgrade head` completes.  This is required
for short-lived CI runners and Lambda-style invocations.
"""
from logging.config import fileConfig
import os
import sys
from pathlib import Path

from sqlalchemy import engine_from_config, pool, create_engine
from alembic import context

# ── Alembic config object ─────────────────────────────────────────────────────
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Ensure project root is on sys.path ────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# ── Import models so Alembic autogenerate can detect schema changes ────────────
from backend.app.database import Base
from backend.app.models import (
    User, Product, Order, Payment, Enquiry,
    Review, Notification, Event, PricingDecision, AuditLog,
)

target_metadata = Base.metadata

# ── Resolve DATABASE_URL ──────────────────────────────────────────────────────
def get_url() -> str:
    """
    Resolution priority:
    1. DATABASE_URL env var  (CI / production RDS — set via GitHub Secret or EB env)
    2. backend/app/config.py DATABASE_URL  (local dev SQLite fallback)
    """
    from backend.app.config import normalize_database_url
    env_url = os.getenv("DATABASE_URL", "").strip()
    if env_url:
        return normalize_database_url(env_url)

    # Fallback: use app config (resolves to absolute SQLite path for local dev)
    from backend.app.config import DATABASE_URL
    return DATABASE_URL


def _is_postgresql(url: str) -> bool:
    return url.startswith("postgresql") or url.startswith("postgres://")


# ── Offline mode ──────────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    """
    Emit raw SQL to stdout without a live DB connection.
    Useful for generating migration scripts to review before applying.
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online mode ───────────────────────────────────────────────────────────────
def run_migrations_online() -> None:
    """
    Run migrations against a live database connection.

    For PostgreSQL (RDS/CI): uses NullPool so the process exits cleanly
    without leaving idle connections open.

    For SQLite (local dev): uses the shared engine from database.py.
    """
    url = get_url()

    if _is_postgresql(url):
        # NullPool: no connection pooling — required for short-lived migration runners.
        # Each migration run opens exactly one connection then closes it immediately.
        connectable = create_engine(url, poolclass=pool.NullPool)
    else:
        # Local dev SQLite: reuse the app's shared engine (avoids locking issues)
        from backend.app.database import engine as sqlite_engine
        connectable = sqlite_engine

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Compare server defaults and types for accurate autogenerate diffs
            compare_server_default=True,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
