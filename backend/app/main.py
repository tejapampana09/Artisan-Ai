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
from backend.app.schemas import HealthResponse, ReadyResponse, UserResponse, ModeUpdateRequest
from backend.app.config import get_cors_origins, ENVIRONMENT
from backend.app.routes.products import router as products_router
from backend.app.routes.ai_catalog import router as ai_router
from backend.app.routes.events import router as events_router
from backend.app.routes.intelligence import router as intelligence_router
from backend.app.routes.pricing import router as pricing_router
from backend.app.routes.sync import router as sync_router
from backend.app.routes.auth import router as auth_router
from backend.app.routes.channels import router as channels_router
from backend.app.routes.reviews import router as reviews_router
from backend.app.routes.notifications import router as notifications_router
from backend.app.routes.artisan import router as artisan_router, seller_router
from backend.app.routes.ml_demand import router as ml_demand_router
from backend.app.routes.artisan_interview import router as interview_router
from backend.app.services.auth import get_current_user as auth_get_current_user

# Initialize database tables directly via SQLAlchemy Base metadata
Base.metadata.create_all(bind=engine)
ensure_sqlite_schema(engine)

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
    lifespan=lifespan
)


cors_origins = get_cors_origins()
cors_kwargs = {
    "allow_origins": cors_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if ENVIRONMENT != "production":
    cors_kwargs["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    **cors_kwargs
)

@app.middleware("http")
async def add_observability_headers(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    response.headers["X-Process-Time-Ms"] = str(duration_ms)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

# Include Routers
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(ai_router)
app.include_router(events_router)
app.include_router(intelligence_router)
app.include_router(pricing_router)
app.include_router(sync_router)
app.include_router(channels_router)
app.include_router(reviews_router)
app.include_router(notifications_router)
app.include_router(artisan_router)
app.include_router(seller_router)
app.include_router(ml_demand_router)
app.include_router(interview_router)


TTS_VOICE_MAP = {
    "te": "te-IN-ShrutiNeural",
    "hi": "hi-IN-SwaraNeural",
    "ta": "ta-IN-PallaviNeural",
    "bn": "bn-IN-TanishaaNeural",
    "en": "en-IN-NeerjaNeural"
}

@app.get("/api/tts/speak")
async def tts_speak_stream(text: str, lang: str = "te"):
    import edge_tts
    from fastapi.responses import StreamingResponse
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Text parameter is required")
    
    clean_lang = (lang or "te").lower()
    voice = TTS_VOICE_MAP.get(clean_lang, "te-IN-ShrutiNeural")

    async def generate_chunks():
        try:
            communicate = edge_tts.Communicate(text, voice)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]
        except Exception as e:
            logging.getLogger("artisan_ai").warning("[TTS Stream Error] %s", e)

    return StreamingResponse(generate_chunks(), media_type="audio/mpeg")

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
        logging.getLogger("artisan_ai").error("Database readiness check failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable"
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
