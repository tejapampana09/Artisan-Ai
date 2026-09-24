import logging
import time
import uuid
import httpx
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.database import engine, Base, get_db
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
from backend.app.routes.addresses import router as addresses_router
from backend.app.routes.ml_demand import router as ml_demand_router
from backend.app.routes.tts import router as tts_router
from backend.app.routes.ondc import router as ondc_router, ondc_network_router
# Explicit database initialization only in non-production environments
if ENVIRONMENT in ["development", "test"]:
    try:
        from backend.app.database import SessionLocal
        
        # Only for SQLite dev/test DBs
        if engine.url.drivername.startswith("sqlite"):
            from backend.app.seed import seed_initial_database
            Base.metadata.create_all(bind=engine)
            
            with SessionLocal() as db_session:
                seed_initial_database(db_session)
    except Exception as db_init_err:
        logging.getLogger("artisan_ai").warning("Dev-mode DB schema/seed warning: %s", db_init_err)

def _check_alembic_head():
    """Fail fast on startup if the database schema is behind the codebase."""
    try:
        from alembic.runtime.migration import MigrationContext
        from alembic.script import ScriptDirectory
        from alembic.config import Config as AlembicConfig
        import os
        alembic_ini = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "alembic.ini"
        )
        if not os.path.exists(alembic_ini):
            return
        from backend.app.database import engine, is_sqlite
        if is_sqlite:
            return  # Only enforce against PostgreSQL
        alembic_cfg = AlembicConfig(alembic_ini)
        script = ScriptDirectory.from_config(alembic_cfg)
        with engine.connect() as conn:
            context = MigrationContext.configure(conn)
            current = set(context.get_current_heads())
            heads = set(script.get_heads())
            if current != heads:
                raise RuntimeError(
                    f"Database schema is out of date — run `alembic upgrade head` before deploying. "
                    f"Current={current}, Expected={heads}"
                )
    except ImportError:
        pass
    except RuntimeError:
        raise
    except Exception as e:
        logging.getLogger("artisan_ai").warning("Alembic migration check skipped: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast if DB schema is behind (production safety guard)
    if ENVIRONMENT == "production":
        _check_alembic_head()

    # Auto-train initial ML model if missing
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
    # Allow private network access only in non-production (dev/local testing)
    if ENVIRONMENT != "production":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    # Security hardening headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(self), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' https://accounts.google.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https: blob:; "
        "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com; "
        "frame-src https://accounts.google.com; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catches all unhandled exceptions and returns a safe generic error — no tracebacks exposed."""
    logging.getLogger("artisan_ai").error(
        "Unhandled exception on %s %s: %s",
        request.method, request.url.path, exc,
        exc_info=True
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Our team has been notified. Please try again shortly."}
    )



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
app.include_router(addresses_router)
app.include_router(ml_demand_router)
app.include_router(tts_router)
app.include_router(ondc_router)
app.include_router(ondc_network_router)


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

_VERSION_METADATA_FALLBACK = {
    "version": "1.0.0",
    "version_code": 1,
    "min_supported_version_code": 1,
    "release_url": "https://github.com/tejapampana09/Artisan-Ai/releases/download/latest/ArtisanAI-Release.apk",
    "release_notes": "Latest updates, AI Assistant guide, and performance enhancements.",
    "release_notes_te": "సరికొత్త ఫీచర్లు, AI అసిస్టెంట్ మరియు అప్‌డేట్‌లు అందుబాటులో ఉన్నాయి.",
    "release_notes_hi": "नवीनतम सुविधाएं और AI असिस्टेंट सुधार उपलब्ध हैं।"
}

_version_cache = {
    "data": _VERSION_METADATA_FALLBACK,
    "expires_at": 0
}


@app.get("/api/app/version")
async def get_latest_app_metadata():
    """
    Returns latest mobile app version metadata for in-app auto updates.
    Dynamically loads latest version.json published by GitHub Actions CI/CD with 60s cache.
    """
    now = time.time()
    if now < _version_cache["expires_at"]:
        return _version_cache["data"]

    try:
        async with httpx.AsyncClient(timeout=3.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://github.com/tejapampana09/Artisan-Ai/releases/download/latest/version.json"
            )
            if resp.status_code == 200:
                data = resp.json()
                if "version_code" in data:
                    _version_cache["data"] = data
                    _version_cache["expires_at"] = now + 60
                    return data
    except Exception:
        pass

    return _version_cache["data"]



