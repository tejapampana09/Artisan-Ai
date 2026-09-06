from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.database import engine, Base, SessionLocal, get_db
from backend.app.models import User, Product, Order, Enquiry, Event, PricingDecision
from backend.app.schemas import HealthResponse, ReadyResponse, UserResponse, ModeUpdateRequest
from backend.app.config import get_cors_origins, ENVIRONMENT
from backend.app.routes.products import router as products_router
from backend.app.routes.ai_catalog import router as ai_router
from backend.app.routes.events import router as events_router
from backend.app.routes.intelligence import router as intelligence_router
from backend.app.routes.pricing import router as pricing_router
from backend.app.routes.sync import router as sync_router
from backend.app.routes.auth import router as auth_router
from backend.app.routes.ondc import router as ondc_router
from backend.app.services.auth import get_current_user as auth_get_current_user

# Create tables automatically only in development/test/demo environments.
# In production, schema management must be performed explicitly via Alembic migrations.
if ENVIRONMENT != "production":
    Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Clean lifecycle: database connections and resource initialization
    yield

app = FastAPI(
    title="Artisan AI API",
    description="Voice-First AI Business Platform & Market Linkage for Marginalized Artisans",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration (Restricted based on ENVIRONMENT and CORS_ORIGINS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import uuid
import time
from fastapi import Request

@app.middleware("http")
async def add_observability_headers(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time-Ms"] = str(duration_ms)
    return response

# Include Routers
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(ai_router)
app.include_router(events_router)
app.include_router(intelligence_router)
app.include_router(pricing_router)
app.include_router(sync_router)
app.include_router(ondc_router)

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
        user_count = db.query(User).count()
        return ReadyResponse(
            status="ready",
            database="connected",
            user_count=user_count
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection failed: {str(e)}"
        )

@app.get("/api/me", response_model=UserResponse)
def get_user_me(current_user: User = Depends(auth_get_current_user)):
    return current_user

@app.patch("/api/me/mode", response_model=UserResponse)
def update_user_mode(
    payload: ModeUpdateRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_get_current_user)
):
    current_user.active_mode = payload.mode
    db.commit()
    db.refresh(current_user)
    return current_user
