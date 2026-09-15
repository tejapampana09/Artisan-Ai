#!/usr/bin/env python3
"""
backend/scripts/seed_admin.py
=============================
Out-of-band administrative provisioning CLI.
Directly accesses database engine/session.
Explicitly:
  - Has NO FastAPI route or HTTP surface.
  - Has NO frontend interface.
  - Has NO default/hardcoded passwords.
  - Requires explicit CLI input or environment variables.
  - Requires explicit --reset flag to overwrite existing admin credentials.

Usage:
  python backend/scripts/seed_admin.py --email admin@example.com --password 'SecureP@ss123' --name 'Super Admin'
  python backend/scripts/seed_admin.py --email admin@example.com --password 'NewP@ss123' --reset
"""

import sys
import os
import argparse
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.database import engine, SessionLocal, Base
from backend.app.models import User
from backend.app.services.auth import hash_password


def validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    if not (has_upper and has_lower and has_digit):
        raise ValueError("Password must contain at least one uppercase letter, one lowercase letter, and one number.")


def seed_admin():
    parser = argparse.ArgumentParser(description="Seed or reset Artisan-AI Administrator account directly in DB.")
    parser.add_argument("--email", default=os.getenv("ADMIN_EMAIL"), help="Admin email address")
    parser.add_argument("--password", default=os.getenv("ADMIN_PASSWORD"), help="Admin password (min 8 chars, strong)")
    parser.add_argument("--name", default=os.getenv("ADMIN_NAME", "System Administrator"), help="Admin full name")
    parser.add_argument("--reset", action="store_true", help="Explicitly allow resetting password if admin already exists")

    args = parser.parse_args()

    email = args.email.strip().lower() if args.email else None
    password = args.password
    name = args.name.strip() if args.name else "System Administrator"

    if not email:
        print("ERROR: Admin email is required. Provide via --email or ADMIN_EMAIL environment variable.", file=sys.stderr)
        sys.exit(1)

    if not password:
        print("ERROR: Admin password is required. Provide via --password or ADMIN_PASSWORD environment variable.", file=sys.stderr)
        sys.exit(1)

    try:
        validate_password_strength(password)
    except ValueError as err:
        print(f"ERROR: Weak password: {err}", file=sys.stderr)
        sys.exit(1)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            if existing.role != "ADMIN":
                print(f"ERROR: User with email '{email}' already exists with role '{existing.role}'. Refusing to overwrite.", file=sys.stderr)
                sys.exit(1)

            if not args.reset:
                print(f"NOTICE: Admin account '{email}' already exists. Pass --reset flag to explicitly update credentials.")
                sys.exit(0)

            # Explicit reset
            existing.name = name
            existing.hashed_password = hash_password(password)
            existing.token_version = (existing.token_version or 1) + 1
            existing.status = "ACTIVE"
            db.commit()
            print(f"SUCCESS: Admin account '{email}' credentials successfully updated (token_version={existing.token_version}).")
        else:
            new_admin = User(
                name=name,
                email=email,
                hashed_password=hash_password(password),
                role="ADMIN",
                status="ACTIVE",
                token_version=1,
                craft="System Administration",
                location="HQ"
            )
            db.add(new_admin)
            db.commit()
            print(f"SUCCESS: New Administrator '{email}' successfully provisioned (ID={new_admin.id}).")
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
