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
    if not url:
        return url
    url = url.strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    # Dialect auto-detection & fallback:
    # If URL requests psycopg (v3) but it is not installed, fallback to psycopg2
    if url.startswith("postgresql+psycopg://"):
        try:
            import psycopg  # noqa: F401
        except ImportError:
            try:
                import psycopg2  # noqa: F401
                url = url.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)
            except ImportError:
                pass
    elif url.startswith("postgresql://") or url.startswith("postgresql+psycopg2://"):
        # If psycopg2 is not installed, fallback to psycopg (v3)
        try:
            import psycopg2  # noqa: F401
        except ImportError:
            try:
                import psycopg  # noqa: F401
                if url.startswith("postgresql+psycopg2://"):
                    url = url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
                else:
                    url = url.replace("postgresql://", "postgresql+psycopg://", 1)
            except ImportError:
                pass

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
RETIRED_EXPOSED_SECRETS = {
    "artisan_ai_prod_secret_key_marginalized_artisans_safety_first_2026",
    "artisan_ai_dev_secret_key_marginalized_artisans_safety_first",
}
DEV_FALLBACK_JWT_SECRET: str = "artisan_ai_dev_fallback_insecure_local_development_only_rot_2026_09"
_env_jwt_secret = os.getenv("JWT_SECRET_KEY") or os.getenv("JWT_SECRET")
JWT_SECRET_KEY: str = _env_jwt_secret if _env_jwt_secret else DEV_FALLBACK_JWT_SECRET

def validate_production_config(env: str, demo_mode: bool = False, database_url: str = "", jwt_secret: str = "", gemini_api_key: str = "") -> bool:
    if env == "production":
        if demo_mode:
            raise RuntimeError("CRITICAL SECURITY CONFIGURATION ERROR: DEMO_MODE cannot be enabled in production!")
        if not jwt_secret or jwt_secret == DEV_FALLBACK_JWT_SECRET or jwt_secret in RETIRED_EXPOSED_SECRETS:
            raise RuntimeError(
                "CRITICAL SECURITY ERROR: JWT_SECRET_KEY is missing or uses an insecure/retired secret. "
                "Rotate to a fresh secret with: openssl rand -hex 32 and inject via AWS Secrets Manager."
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
        if not gemini_api_key:
            raise RuntimeError(
                "CRITICAL CONFIGURATION ERROR: GEMINI_API_KEY is not set. "
                "All AI features will fail. Set this in your platform's secret manager."
            )
    return True

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
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-lite").strip()
_raw_fallback_models = os.getenv("GEMINI_FALLBACK_MODELS", "gemini-2.0-flash,gemini-1.5-flash-latest")
GEMINI_FALLBACK_MODELS: List[str] = [m.strip() for m in _raw_fallback_models.split(",") if m.strip()]

validate_production_config(ENVIRONMENT, DEMO_MODE, DATABASE_URL, JWT_SECRET_KEY, GEMINI_API_KEY)

MARKET_SEARCH_GEMINI_MODEL: str = os.getenv("MARKET_SEARCH_GEMINI_MODEL", "gemini-2.0-flash-lite").strip()

_raw_market_search_fallback_models = os.getenv("MARKET_SEARCH_GEMINI_FALLBACK_MODELS", "gemini-2.0-flash,gemini-1.5-flash-latest")
MARKET_SEARCH_GEMINI_FALLBACK_MODELS: List[str] = [m.strip() for m in _raw_market_search_fallback_models.split(",") if m.strip()]
AI_REQUEST_TIMEOUT_SECONDS: float = float(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", "10.0"))

# Google OAuth Client ID (used for id_token audience claim validation)
GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "").strip()


# Market Research API & Search Strategy configuration (SearXNG is primary low-cost provider)
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

# Push Notification & FCM Configuration
FCM_SERVER_KEY: str = os.getenv("FCM_SERVER_KEY", "").strip()
FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "").strip()

# ONDC Retail Integration Configuration (Beckn Protocol v1.2)
ONDC_ENVIRONMENT: str = os.getenv("ONDC_ENVIRONMENT", ENVIRONMENT).lower()
ONDC_SUBSCRIBER_ID: str = os.getenv("ONDC_SUBSCRIBER_ID", "").strip()
ONDC_UNIQUE_KEY_ID: str = os.getenv("ONDC_UNIQUE_KEY_ID", "").strip()
ONDC_PUBLIC_KEY: str = os.getenv("ONDC_PUBLIC_KEY", "").strip()
ONDC_PRIVATE_KEY: str = os.getenv("ONDC_PRIVATE_KEY", "").strip()
ONDC_GATEWAY_URL: str = os.getenv("ONDC_GATEWAY_URL", "").strip()
ONDC_BPP_URI: str = os.getenv("ONDC_BPP_URI", "http://localhost:8000/ondc").strip()
ONDC_DOMAIN: str = os.getenv("ONDC_DOMAIN", "ONDC:RET12").strip()
ONDC_CITY: str = os.getenv("ONDC_CITY", "std:080").strip()
ONDC_COUNTRY: str = os.getenv("ONDC_COUNTRY", "IND").strip()

# Email Notification & SMTP Configuration (for Wishlist & Order alerts)
SMTP_HOST: str = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER: str = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "support@artisanai.in").strip()
SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Artisan AI").strip()
APP_FRONTEND_URL: str = os.getenv("APP_FRONTEND_URL", "https://artisanai.in").strip().rstrip("/")

