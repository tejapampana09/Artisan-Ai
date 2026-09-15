import os
import hmac
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User
from backend.app.config import (
    JWT_SECRET_KEY, 
    JWT_ALGORITHM, 
    ACCESS_TOKEN_EXPIRE_MINUTES,
    DEMO_MODE,
    ENVIRONMENT
)

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000
    )
    return f"{salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    if not hashed_password or "$" not in hashed_password:
        return False
    try:
        salt, stored_hash = hashed_password.split("$", 1)
        key = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            100_000
        )
        return secrets.compare_digest(key.hex(), stored_hash)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

def extract_token_from_header(auth_header: Optional[str]) -> Optional[str]:
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None

def get_current_user_strict(
    db: Session = Depends(get_db),
    auth_header: Optional[str] = Header(None, alias="Authorization")
) -> User:
    """
    Strict dependency: Requires a valid JWT token.
    Raises 401 if missing or invalid.
    """
    token = extract_token_from_header(auth_header)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided. Expected Bearer token.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    user_id = payload.get("sub")
    try:
        user_id_int = int(str(user_id))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = db.query(User).filter(User.id == user_id_int).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token not found.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    token_ver = payload.get("ver")
    user_ver = getattr(user, "token_version", 1) or 1
    if token_ver is None or token_ver != user_ver:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked or is invalid due to a password update. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return user

def get_current_user(
    db: Session = Depends(get_db),
    auth_header: Optional[str] = Header(None, alias="Authorization")
) -> User:
    """
    Controlled authentication dependency:
    1. If a Bearer token is provided, strictly validates and returns that specific user.
    2. If NO Bearer token is provided:
       - In PRODUCTION or when DEMO_MODE is False: Strictly REJECTS with 401 Unauthorized.
       - In non-production ONLY when DEMO_MODE is explicitly True: Grants access to the designated test/dev account.
    3. If an INVALID token is provided: Strictly rejects with 401 Unauthorized in all environments.
    """
    token = extract_token_from_header(auth_header)
    if token:
        payload = decode_access_token(token)
        if not payload or "sub" not in payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        try:
            user_id_int = int(str(payload.get("sub")))
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        user = db.query(User).filter(User.id == user_id_int).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User associated with token not found.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        token_ver = payload.get("ver")
        user_ver = getattr(user, "token_version", 1) or 1
        if token_ver is None or token_ver != user_ver:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked or is invalid due to a password update. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        return user

    # Strict check: NEVER allow unauthenticated fallback in production or when DEMO_MODE is false
    if ENVIRONMENT == "production" or not DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided. Expected Bearer token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # In explicit automated test suite mode only (when DEMO_MODE is explicitly True and non-production):
    user = db.query(User).filter(User.role == "ARTISAN").first()
    if user:
        return user
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication credentials were not provided. Expected Bearer token.",
        headers={"WWW-Authenticate": "Bearer"}
    )

def get_optional_current_user(
    db: Session = Depends(get_db),
    auth_header: Optional[str] = Header(None, alias="Authorization")
) -> Optional[User]:
    """Returns authenticated user if valid non-revoked token present, else None without raising 401."""
    token = extract_token_from_header(auth_header)
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    try:
        user = db.query(User).filter(User.id == int(payload["sub"])).first()
        if not user:
            return None
        token_ver = payload.get("ver")
        user_ver = getattr(user, "token_version", 1) or 1
        if token_ver is None or token_ver != user_ver:
            return None
        return user
    except Exception:
        return None

def create_domain_token(
    user: User,
    auth_domain: str,
    session_type: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Issues a V3 domain-isolated JWT access token.
    auth_domain: "MARKETPLACE" | "ARTISAN_STUDIO" | "ADMIN"
    session_type: "BUYER" | "STUDIO" | "ADMIN"
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": str(user.id),
        "name": user.name,
        "role": user.role,
        "auth_domain": auth_domain,
        "session_type": session_type,
        "ver": getattr(user, "token_version", 1) or 1,
        "exp": expire
    }
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def get_token_payload_strict(
    auth_header: Optional[str] = Header(None, alias="Authorization")
) -> dict:
    """
    Strictly extracts and validates JWT payload.
    Raises 401 on missing, expired, or corrupted token.
    """
    token = extract_token_from_header(auth_header)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided. Expected Bearer token.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return payload

def require_buyer(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload_strict)
) -> User:
    """
    V3 Strict Buyer Authorization Dependency:
    - Token auth_domain MUST be "MARKETPLACE"
    - Token session_type MUST be "BUYER"
    - Database account role MUST be "BUYER"
    - Account status MUST be "ACTIVE"
    NO ADMIN or ARTISAN bypass allowed.
    """
    if payload.get("auth_domain") != "MARKETPLACE" or payload.get("session_type") != "BUYER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Valid Marketplace Buyer session required."
        )

    try:
        user_id = int(str(payload.get("sub")))
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    if getattr(user, "token_version", 1) != payload.get("ver"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked. Please log in again.")

    if getattr(user, "status", "ACTIVE") != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended or disabled.")

    if user.role != "BUYER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Account is not registered as a Buyer."
        )

    return user

def require_artisan(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload_strict)
) -> User:
    """
    V3 Strict Artisan Authorization Dependency:
    - Token auth_domain MUST be "ARTISAN_STUDIO"
    - Token session_type MUST be "STUDIO"
    - Database account role MUST be "ARTISAN"
    - Account status MUST be "ACTIVE"
    NO BUYER or ADMIN bypass allowed.
    """
    if payload.get("auth_domain") != "ARTISAN_STUDIO" or payload.get("session_type") != "STUDIO":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Valid Artisan Studio session required."
        )

    try:
        user_id = int(str(payload.get("sub")))
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Artisan not found.")

    if getattr(user, "token_version", 1) != payload.get("ver"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked. Please log in again.")

    if getattr(user, "status", "ACTIVE") != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Artisan account is suspended or disabled.")

    if user.role != "ARTISAN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Account is not registered as an Artisan."
        )

    return user

def require_admin(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload_strict)
) -> User:
    """
    V3 Strict Admin Authorization Dependency:
    - Token auth_domain MUST be "ADMIN"
    - Token session_type MUST be "ADMIN"
    - Database account role MUST be "ADMIN"
    - Account status MUST be "ACTIVE"
    """
    if payload.get("auth_domain") != "ADMIN" or payload.get("session_type") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Valid Admin session required."
        )

    try:
        user_id = int(str(payload.get("sub")))
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin account not found.")

    if getattr(user, "token_version", 1) != payload.get("ver"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked. Please log in again.")

    if getattr(user, "status", "ACTIVE") != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin account is disabled.")

    if user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Account does not possess Administrator privileges."
        )

    return user
