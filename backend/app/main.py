from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.database import engine, Base, SessionLocal, get_db
from backend.app.models import User
from backend.app.schemas import HealthResponse, ReadyResponse, UserResponse, ModeUpdateRequest
from backend.app.routes.products import router as products_router
from backend.app.routes.ai_catalog import router as ai_router
from backend.app.routes.events import router as events_router
from backend.app.seed import seed_sample_products

# Create tables
Base.metadata.create_all(bind=engine)

def ensure_default_user(db: Session) -> User:
    user = db.query(User).first()
    if not user:
        user = User(
            name="Lakshmi Devi",
            phone="+91 98765 43210",
            active_mode="SELL",
            location="Machilipatnam, Andhra Pradesh",
            craft="Hand-block Kalamkari"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        user = ensure_default_user(db)
        seed_sample_products(db, user.id)
    finally:
        db.close()
    yield

app = FastAPI(
    title="Artisan AI API",
    description="Voice-First AI Business Platform & Market Linkage for Marginalized Artisans",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(products_router)
app.include_router(ai_router)
app.include_router(events_router)

@app.get("/api/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="ok",
        version="1.0.0",
        timestamp=datetime.now(timezone.utc)
    )

@app.get("/api/ready", response_model=ReadyResponse)
def readiness_check(db: Session = Depends(get_db)):
    try:
        # Check DB connection
        db.execute(text("SELECT 1"))
        user = ensure_default_user(db)
        seed_sample_products(db, user.id)
        user_count = db.query(User).count()
        return ReadyResponse(
            status="ready",
            database="connected",
            user_count=user_count
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database not ready: {str(e)}")

@app.get("/api/me", response_model=UserResponse)
def get_current_user(db: Session = Depends(get_db)):
    user = ensure_default_user(db)
    return user

@app.patch("/api/me/mode", response_model=UserResponse)
def update_user_mode(payload: ModeUpdateRequest, db: Session = Depends(get_db)):
    user = ensure_default_user(db)
    user.active_mode = payload.mode
    db.commit()
    db.refresh(user)
    return user
