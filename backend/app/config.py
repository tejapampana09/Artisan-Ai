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

_raw_demo_mode = os.getenv("DEMO_MODE")
if ENVIRONMENT == "production":
    DEMO_MODE: bool = False if _raw_demo_mode is None else (_raw_demo_mode.lower() in ("true", "1", "yes"))
else:
    DEMO_MODE: bool = _raw_demo_mode.lower() in ("true", "1", "yes") if _raw_demo_mode is not None else True

# Database URL
raw_db_url: str = os.getenv("DATABASE_URL", "sqlite:///./artisan_ai.db")
DATABASE_URL: str = normalize_database_url(raw_db_url)

# JWT Authentication
DEV_FALLBACK_JWT_SECRET: str = "artisan_ai_dev_secret_key_marginalized_artisans_safety_first"
_env_jwt_secret = os.getenv("JWT_SECRET_KEY")
JWT_SECRET_KEY: str = _env_jwt_secret or (DEV_FALLBACK_JWT_SECRET if ENVIRONMENT != "production" else "")

def validate_production_config(env: str, demo_mode: bool = False, database_url: str = "", jwt_secret: str = "") -> bool:
    """Strict configuration validator for production deployments."""
    if env == "production":
        if demo_mode:
            raise RuntimeError("CRITICAL SECURITY CONFIGURATION ERROR: DEMO_MODE cannot be enabled in production! Set DEMO_MODE=false.")
        if not jwt_secret or jwt_secret == DEV_FALLBACK_JWT_SECRET or "artisan_ai_dev" in jwt_secret or "sih_" in jwt_secret or "dev-" in jwt_secret:
            raise RuntimeError("CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET_KEY environment variable must be explicitly set to a secure, unpredictable secret in production! Do not use predictable development fallback secrets.")
        if database_url.startswith("sqlite"):
            raise RuntimeError("CRITICAL SECURITY CONFIGURATION ERROR: SQLite cannot be used as the production database. Set DATABASE_URL to PostgreSQL.")
    return True

# Validate active environment settings
validate_production_config(ENVIRONMENT, DEMO_MODE, DATABASE_URL, JWT_SECRET_KEY)

JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 hours

# CORS origins
raw_cors = os.getenv(
    "CORS_ORIGINS", 
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000,http://localhost:3000"
)

def get_cors_origins() -> List[str]:
    # In production, restrict to configured domains; in development allow configured + localhost
    origins = [origin.strip() for origin in raw_cors.split(",") if origin.strip()]
    if ENVIRONMENT == "development" and "*" not in origins:
        origins.extend(["http://localhost:5173", "http://127.0.0.1:5173"])
    return list(set(origins))

# AI API configuration
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
AI_REQUEST_TIMEOUT_SECONDS: float = float(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", "10.0"))
