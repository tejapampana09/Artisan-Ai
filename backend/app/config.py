import os
from typing import List

# Environment & Demo Mode
ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower()

# DEMO_MODE explicitly controls whether demo fallback is permitted.
# In production, DEMO_MODE defaults to False.
# In development/test, DEMO_MODE defaults to True unless explicitly disabled.
DEMO_MODE: bool = os.getenv(
    "DEMO_MODE", 
    "true" if ENVIRONMENT != "production" else "false"
).lower() in ("true", "1", "yes")

# Database
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./artisan_ai.db")

# JWT Authentication
DEV_FALLBACK_JWT_SECRET: str = "sih_2026_artisan_ai_dev_secret_key_marginalized_artisans_safety_first"
_env_jwt_secret = os.getenv("JWT_SECRET_KEY")

if ENVIRONMENT == "production":
    if not _env_jwt_secret or _env_jwt_secret == DEV_FALLBACK_JWT_SECRET:
        raise RuntimeError(
            "CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET_KEY environment variable "
            "must be explicitly set to a secure, unpredictable secret in production! "
            "Do not use predictable development fallback secrets."
        )
    JWT_SECRET_KEY: str = _env_jwt_secret
else:
    JWT_SECRET_KEY: str = _env_jwt_secret or DEV_FALLBACK_JWT_SECRET

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
