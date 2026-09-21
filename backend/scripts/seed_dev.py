import os
from sqlalchemy.orm import Session
from backend.app.database import SessionLocal
from backend.app.models import User
from backend.app.services.auth import hash_password

def seed_dev_data():
    """
    Explicit dev-only seed script. Uses environment variables for credentials.
    """
    email = os.getenv("DEV_ARTISAN_EMAIL", "dev-artisan@artisanai.com")
    password = os.getenv("DEV_ARTISAN_PASSWORD", "dev-password123")
    
    with SessionLocal() as db:
        artisan = db.query(User).filter(User.email == email).first()
        if not artisan:
            artisan = User(
                name="Dev Artisan",
                email=email,
                phone="0000000000",
                hashed_password=hash_password(password),
                role="ARTISAN",
                status="ACTIVE",
                location="Development",
                craft="Development",
                verification_status="VERIFIED_ARTISAN",
            )
            db.add(artisan)
            db.commit()
            print(f"Seeded dev artisan: {email}")
        else:
            print(f"Dev artisan already exists: {email}")

if __name__ == "__main__":
    seed_dev_data()
