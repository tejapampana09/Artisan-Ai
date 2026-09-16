import logging
import time
import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.database import engine, Base, get_db, ensure_sqlite_schema
from backend.app.models import User, Product, Order, Enquiry, Event, PricingDecision, ProcessedOperation
from backend.app.schemas import HealthResponse, ReadyResponse, UserResponse
from backend.app.config import get_cors_origins, ENVIRONMENT
from backend.app.routes.products import (
    router as products_router,
    public_products_router,
    marketplace_products_router,
    studio_products_router,
    admin_products_router
)
from backend.app.routes.ai_catalog import router as ai_router
from backend.app.routes.events import router as events_router
from backend.app.routes.intelligence import router as intelligence_router
from backend.app.routes.pricing import router as pricing_router
from backend.app.routes.sync import router as sync_router
from backend.app.routes.marketplace_auth import router as marketplace_auth_router
from backend.app.routes.marketplace_payments import router as marketplace_payments_router
from backend.app.routes.studio_auth import router as studio_auth_router
from backend.app.routes.admin_auth import router as admin_auth_router
from backend.app.routes.admin_ops import admin_ops_router
from backend.app.routes.channels import router as channels_router
from backend.app.routes.reviews import router as reviews_router
from backend.app.routes.notifications import router as notifications_router
from backend.app.routes.artisan import router as artisan_router
from backend.app.routes.ml_demand import router as ml_demand_router
from backend.app.routes.tts import router as tts_router
# Always ensure database schema is created and default artisan/admin accounts are seeded
try:
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_schema(engine)
    from backend.app.database import SessionLocal
    from backend.app.seed import seed_initial_database
    with SessionLocal() as db_session:
        seed_initial_database(db_session)
except Exception as db_init_err:
    logging.getLogger("artisan_ai").warning("Startup DB schema/seed warning: %s", db_init_err)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Clean lifecycle: auto-train initial ML model if missing
    import os
    model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml", "demand_model.joblib")
    if not os.path.exists(model_path):
        try:
            from backend.ml.train_demand_model import train_and_save_model
            train_and_save_model()
        except Exception as e:
            logging.getLogger("artisan_ai").warning("ML startup model initialization skipped: %s", e)
    yield

app = FastAPI(
    title="Artisan AI API",
    description="Voice-First AI Business Platform & Market Linkage for Marginalized Artisans",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if ENVIRONMENT != "production" else None,
    openapi_url="/openapi.json" if ENVIRONMENT != "production" else None,
)


cors_origins = get_cors_origins()
cors_kwargs = {
    "allow_origins": cors_origins,
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "allow_headers": ["Authorization", "Content-Type", "X-Request-ID", "Accept", "X-Requested-With"],
    "expose_headers": ["X-Request-ID", "X-Process-Time-Ms"],
    "max_age": 600,
}
if ENVIRONMENT != "production":
    cors_kwargs["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    **cors_kwargs
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)
    # Observability
    response.headers["X-Request-ID"] = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    response.headers["X-Process-Time-Ms"] = str(duration_ms)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    # Security hardening headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(self), geolocation=()"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response

# Include Routers
app.include_router(marketplace_auth_router)
app.include_router(marketplace_payments_router)
app.include_router(studio_auth_router)
app.include_router(admin_auth_router)
app.include_router(admin_ops_router)
app.include_router(products_router)
app.include_router(public_products_router)
app.include_router(marketplace_products_router)
app.include_router(studio_products_router)
app.include_router(admin_products_router)
app.include_router(ai_router)
app.include_router(events_router)
app.include_router(intelligence_router)
app.include_router(pricing_router)
app.include_router(sync_router)
app.include_router(channels_router)
app.include_router(reviews_router)
app.include_router(notifications_router)
app.include_router(artisan_router)
app.include_router(ml_demand_router)
app.include_router(tts_router)


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
        db.execute(text("SELECT 1"))
        return ReadyResponse(
            status="ready",
            database="connected",
        )
    except Exception as e:
        logging.getLogger("artisan_ai").error("Database readiness check failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable. Please try again shortly."
        )


