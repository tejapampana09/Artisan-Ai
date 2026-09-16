import os
from pathlib import Path
from typing import List

# Load environment variables from .env file if available
try:
    from dotenv import load_dotenv
    root_env = Path(__file__).resolve().parent.parent.parent / ".env"
    if root_env.exists():
        load_dotenv(dotenv_path=root_env)
    else:
        load_dotenv()
except ImportError:
    pass

def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url

get_database_url = normalize_database_url

# Environment & Demo Mode
ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower()
_raw_demo_mode = os.getenv("DEMO_MODE", "false")
DEMO_MODE: bool = _raw_demo_mode.lower() in ("true", "1", "yes")

# ONDC Prototype feature flag (default False in production, True in non-production)
ONDC_PROTOTYPE_ENABLED: bool = os.getenv("ONDC_PROTOTYPE_ENABLED", "false" if ENVIRONMENT == "production" else "true").lower() in ("true", "1", "yes")

# Database URL
raw_db_url: str = os.getenv("DATABASE_URL", "sqlite:///./artisan_ai.db")
if raw_db_url.startswith("sqlite:///./") or raw_db_url == "sqlite:///artisan_ai.db":
    db_file = (Path(__file__).resolve().parent.parent.parent / "artisan_ai.db").resolve()
    DATABASE_URL = f"sqlite:///{db_file.as_posix()}"
else:
    DATABASE_URL = normalize_database_url(raw_db_url)

# JWT Authentication
DEV_FALLBACK_JWT_SECRET: str = "artisan_ai_dev_secret_key_marginalized_artisans_safety_first"
_env_jwt_secret = os.getenv("JWT_SECRET_KEY") or os.getenv("JWT_SECRET")
JWT_SECRET_KEY: str = _env_jwt_secret if _env_jwt_secret else DEV_FALLBACK_JWT_SECRET

def validate_production_config(env: str, demo_mode: bool = False, database_url: str = "", jwt_secret: str = "") -> bool:
    if env == "production":
        if demo_mode:
            raise RuntimeError("CRITICAL SECURITY CONFIGURATION ERROR: DEMO_MODE cannot be enabled in production!")
        if not jwt_secret or jwt_secret == DEV_FALLBACK_JWT_SECRET:
            raise RuntimeError(
                "CRITICAL SECURITY ERROR: JWT_SECRET_KEY is not set or is using the insecure dev fallback. "
                "Generate a strong secret with: openssl rand -hex 32"
            )
        if len(jwt_secret) < 32:
            raise RuntimeError(
                "CRITICAL SECURITY ERROR: JWT_SECRET_KEY is too short (minimum 32 characters). "
                "Generate a strong secret with: openssl rand -hex 32"
            )
        if not database_url or "sqlite" in database_url.lower():
            raise RuntimeError(
                "CRITICAL CONFIGURATION ERROR: SQLite cannot be used in production (ephemeral filesystem). "
                "Set DATABASE_URL to a PostgreSQL connection string."
            )
    return True

validate_production_config(ENVIRONMENT, DEMO_MODE, DATABASE_URL, JWT_SECRET_KEY)

JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # 8h default (was 24h)

# CORS origins
raw_cors = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000,http://localhost:3000")

def get_cors_origins() -> List[str]:
    origins = [origin.strip() for origin in raw_cors.split(",") if origin.strip()]
    if ENVIRONMENT == "production":
        return origins
    default_dev_origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:4173", "http://127.0.0.1:4173"]
    return list(set(origins + default_dev_origins))

# AI API configuration
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite").strip()
_raw_fallback_models = os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.6-flash,gemini-3.5-flash")
GEMINI_FALLBACK_MODELS: List[str] = [m.strip() for m in _raw_fallback_models.split(",") if m.strip()]

MARKET_SEARCH_GEMINI_MODEL: str = os.getenv("MARKET_SEARCH_GEMINI_MODEL", "gemini-3.1-flash-lite").strip()
_raw_market_search_fallback_models = os.getenv("MARKET_SEARCH_GEMINI_FALLBACK_MODELS", "gemini-3.6-flash,gemini-3.5-flash")
MARKET_SEARCH_GEMINI_FALLBACK_MODELS: List[str] = [m.strip() for m in _raw_market_search_fallback_models.split(",") if m.strip()]
AI_REQUEST_TIMEOUT_SECONDS: float = float(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", "10.0"))

# Market Research API & Search Strategy configuration
MARKET_RESEARCH_PROVIDER: str = os.getenv("MARKET_RESEARCH_PROVIDER", "SEARXNG").strip().upper()
MARKET_RESEARCH_API_KEY: str = os.getenv("MARKET_RESEARCH_API_KEY", "").strip()
MARKET_SEARCH_COUNTRY: str = os.getenv("MARKET_SEARCH_COUNTRY", "IN").strip()
MARKET_SEARCH_LANGUAGE: str = os.getenv("MARKET_SEARCH_LANGUAGE", "en").strip()
MARKET_SEARCH_MAX_RESULTS: int = int(os.getenv("MARKET_SEARCH_MAX_RESULTS", "10"))
SEARXNG_BASE_URL: str = os.getenv("SEARXNG_BASE_URL", "http://localhost:8080").strip().rstrip("/")

# Pricing Engine Business Constants & Bounds
MIN_MARGIN_PCT: float = float(os.getenv("PRICING_MIN_MARGIN_PCT", "0.20"))
MARKET_MEDIAN_WEIGHT: float = float(os.getenv("PRICING_MARKET_MEDIAN_WEIGHT", "0.30"))
MAX_UPWARD_ADJUSTMENT_PCT: float = float(os.getenv("PRICING_MAX_UPWARD_ADJUSTMENT_PCT", "0.25"))
MAX_DOWNWARD_ADJUSTMENT_PCT: float = float(os.getenv("PRICING_MAX_DOWNWARD_ADJUSTMENT_PCT", "0.10"))
MIN_DEMAND_FACTOR: float = float(os.getenv("PRICING_MIN_DEMAND_FACTOR", "0.95"))
MAX_DEMAND_FACTOR: float = float(os.getenv("PRICING_MAX_DEMAND_FACTOR", "1.15"))

# Payment Gateway Configuration
RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "").strip()
RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
