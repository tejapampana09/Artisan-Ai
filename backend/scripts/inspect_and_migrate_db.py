#!/usr/bin/env python3
"""
backend/scripts/inspect_and_migrate_db.py
=========================================
Safe Database Migration & Pre-flight Inspection CLI for Production/RDS.
Never auto-stamps production schemas.

Decision tree:
  1. Inspect DB schema columns & alembic_version.
  2. If already at Alembic head -> Reports clean.
  3. If physical schema matches V3 but alembic_version is empty:
     -> STOP. Reports matching schema. Requires explicit --stamp-head confirmation.
  4. If partially migrated:
     -> STOP. Reports exact discrepancies without executing changes.
  5. If legacy clean schema:
     -> Runs 'alembic upgrade head' safely when --upgrade is provided.

Usage:
  python backend/scripts/inspect_and_migrate_db.py             # Dry-run inspection
  python backend/scripts/inspect_and_migrate_db.py --upgrade   # Run alembic upgrade head (if safe)
  python backend/scripts/inspect_and_migrate_db.py --stamp-head # Explicit stamp confirmation
"""

import sys
import os
import argparse
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import inspect as sa_inspect, text
from backend.app.database import engine
from backend.app.config import DATABASE_URL, ENVIRONMENT


def inspect_schema():
    inspector = sa_inspect(engine)
    existing_tables = set(inspector.get_table_names())

    # Check alembic_version
    current_alembic_version = None
    if "alembic_version" in existing_tables:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).fetchone()
            if result:
                current_alembic_version = result[0]

    # Expected V3 checkpoints
    v3_checks = {
        "users.status": False,
        "users.token_version": False,
        "payments_table": "payments" in existing_tables,
        "orders.payment_status": False,
        "orders.payment_tx_id": False,
    }

    if "users" in existing_tables:
        user_cols = {c["name"] for c in inspector.get_columns("users")}
        v3_checks["users.status"] = "status" in user_cols
        v3_checks["users.token_version"] = "token_version" in user_cols

    if "orders" in existing_tables:
        order_cols = {c["name"] for c in inspector.get_columns("orders")}
        v3_checks["orders.payment_status"] = "payment_status" in order_cols
        v3_checks["orders.payment_tx_id"] = "payment_tx_id" in order_cols

    return existing_tables, current_alembic_version, v3_checks


def main():
    parser = argparse.ArgumentParser(description="Inspect RDS/Production DB schema and safely execute Alembic migrations.")
    parser.add_argument("--upgrade", action="store_true", help="Execute alembic upgrade head if migration is safe")
    parser.add_argument("--stamp-head", action="store_true", help="Explicit confirmation to stamp head when schema already has V3 columns")
    args = parser.parse_args()

    print("=" * 70)
    print("Artisan-AI V3 — Database Migration Pre-flight Inspection")
    print("=" * 70)
    print(f"Environment:  {ENVIRONMENT}")
    print(f"Database URL: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")

    tables, alembic_ver, v3_checks = inspect_schema()

    print("\nV3 Feature Checks:")
    for feature, present in v3_checks.items():
        status_icon = "[OK]     " if present else "[MISSING]"
        print(f"  {status_icon} {feature}")

    all_v3_present = all(v3_checks.values())
    none_v3_present = not any(v3_checks.values())
    partial_v3 = any(v3_checks.values()) and not all_v3_present

    print("-" * 70)

    # Decision Tree
    if alembic_ver == "0004_product_draft":
        print("STATUS: DATABASE IS FULLY UP TO DATE (head: 0004_product_draft).")
        print("No migration actions required.")
        return

    if all_v3_present and not alembic_ver:
        print("STATUS: PHYSICAL SCHEMA ALREADY MATCHES V3, BUT ALEMBIC VERSION IS UNINITIALIZED.")
        print("WARNING: Running 'alembic upgrade head' now may attempt duplicate column additions.")
        if args.stamp_head:
            print("\nExecuting explicit 'alembic stamp head' per user confirmation...")
            from alembic.config import Config
            from alembic import command
            alembic_cfg = Config("alembic.ini")
            command.stamp(alembic_cfg, "head")
            print("SUCCESS: Database successfully stamped at Alembic head.")
        else:
            print("\nSAFETY STOP: To synchronize Alembic tracking with this existing schema, re-run with:")
            print("  python backend/scripts/inspect_and_migrate_db.py --stamp-head")
            print("(Never auto-stamping to avoid false-positive assumptions).")
        return

    if partial_v3:
        print("STATUS: PARTIALLY MIGRATED SCHEMA DETECTED!")
        print("SAFETY STOP: Some V3 columns exist while others are missing.")
        print("Running blind 'upgrade head' could fail with duplicate column or relation errors.")
        print("Please review the missing items above and resolve table state before upgrading.")
        sys.exit(1)

    if none_v3_present or alembic_ver:
        print("STATUS: CLEAN UPGRADE PATH DETECTED.")
        if args.upgrade:
            print("\nApplying Alembic migrations ('alembic upgrade head')...")
            from alembic.config import Config
            from alembic import command
            alembic_cfg = Config("alembic.ini")
            command.upgrade(alembic_cfg, "head")
            print("SUCCESS: Migrations completed cleanly to head.")
        else:
            print("To apply migrations, run:")
            print("  python backend/scripts/inspect_and_migrate_db.py --upgrade")


if __name__ == "__main__":
    main()
