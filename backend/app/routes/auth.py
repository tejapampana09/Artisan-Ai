from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.database import get_db
from backend.app.models import User
from backend.app.schemas import UserRegister, UserLogin, ResetPasswordRequest, ChangePasswordRequest, TokenResponse, UserResponse, GoogleAuthRequest
from backend.app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_strict,
    get_current_user
)
from backend.app.services.rate_limiter import rate_limiter, get_client_identifier

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegister, request: Request, db: Session = Depends(get_db)):
    """
    Registers a new artisan or buyer with secure password hashing.
    Generates and returns a JWT access token.
    Enforces sliding window rate limits to prevent automated account creation.
    """
    rate_limiter.check_rate_limit(f"reg:{get_client_identifier(request)}", max_requests=5, window_seconds=60)

    clean_email = payload.email.strip().lower() if (payload.email and payload.email.strip()) else None
    clean_phone = payload.phone.strip() if (payload.phone and payload.phone.strip()) else None

    if not clean_email and not clean_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide at least an email address or phone number for registration."
        )

    # Check if user with given email or phone exists
    filters = []
    if clean_email:
        filters.append(User.email == clean_email)
    if clean_phone:
        filters.append(User.phone == clean_phone)

    if filters:
        existing = db.query(User).filter(or_(*filters)).first()
        if existing:
            if clean_email and existing.email == clean_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A user with this email address is already registered."
                )
            if clean_phone and existing.phone == clean_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A user with this phone number is already registered."
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email or phone number is already registered."
            )

    user_role = (payload.role or "ARTISAN").upper().strip()
    if user_role not in {"ARTISAN", "BUYER"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role 'ADMIN' cannot be self-registered. Public self-registration is permitted for ARTISAN or BUYER roles only."
        )
    user_active_mode = "BUY" if user_role == "BUYER" else (payload.active_mode or "SELL")

    new_user = User(
        name=payload.name.strip(),
        email=clean_email,
        phone=clean_phone,
        hashed_password=hash_password(payload.password),
        role=user_role,
        active_mode=user_active_mode,
        location=payload.location or "India",
        craft=payload.craft or ("Connoisseur Collection" if user_role == "BUYER" else "Handcrafted Goods")
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token({
        "sub": str(new_user.id),
        "name": new_user.name,
        "role": new_user.role,
        "ver": new_user.token_version or 1
    })

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=new_user
    )

@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    """
    Authenticates a user via email or phone number and password.
    Returns JWT access token.
    Enforces sliding window rate limits (max 5 attempts per 60 seconds).
    """
    rate_limiter.check_rate_limit(f"login:{get_client_identifier(request)}", max_requests=5, window_seconds=60)
    identifier = payload.email_or_phone.strip()
    import re
    digits = re.sub(r"\D", "", identifier)
    match_conditions = [User.email == identifier.lower(), User.phone == identifier]
    if len(digits) == 10:
        match_conditions.extend([
            User.phone == digits,
            User.phone == f"+91{digits}",
            User.phone == f"91{digits}",
            User.phone == f"0{digits}"
        ])
    elif len(digits) == 12 and digits.startswith("91"):
        pure_10 = digits[2:]
        match_conditions.extend([
            User.phone == digits,
            User.phone == f"+{digits}",
            User.phone == pure_10,
            User.phone == f"0{pure_10}"
        ])

    user = db.query(User).filter(or_(*match_conditions)).first()

    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please check your email/phone and password."
        )

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please check your email/phone and password."
        )

    if payload.required_role:
        expected = payload.required_role.strip().upper()
        if expected in ["ARTISAN", "SELLER"] and user.role not in ["ARTISAN", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. This account is registered as a Customer/Buyer. Seller Studio is strictly reserved for verified Artisans and Administrators."
            )
        elif expected == "BUYER" and user.role not in ["BUYER", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. This account is registered as an Artisan. Please sign in via the Artisan Studio portal."
            )

    access_token = create_access_token({
        "sub": str(user.id),
        "name": user.name,
        "role": user.role,
        "ver": user.token_version or 1
    })

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )

@router.post("/google", response_model=TokenResponse)
def google_auth(payload: GoogleAuthRequest, request: Request, db: Session = Depends(get_db)):
    """
    Authenticates or registers a user via Google OAuth 2.0 / One Tap credentials.
    Verifies tokens against Google's official API servers.
    Generates and returns a JWT access token.
    """
    rate_limiter.check_rate_limit(f"google_auth:{get_client_identifier(request)}", max_requests=10, window_seconds=60)
    
    verified_email = None
    verified_name = None
    verified_google_id = None

    import httpx
    # 1. Verify Google OAuth 2.0 Access Token (from real Google OAuth popup)
    if payload.access_token:
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {payload.access_token}"}
                )
                if res.status_code == 200:
                    data = res.json()
                    verified_email = data.get("email")
                    verified_name = data.get("name")
                    verified_google_id = data.get("sub")
        except Exception as e:
            import logging
            logging.getLogger("artisan_ai").warning("Google userinfo token check failed: %s", e)

    # 2. Verify Google ID Token (from Google Identity Services One Tap / credential response)
    if not verified_email and payload.token:
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.get(
                    f"https://oauth2.googleapis.com/tokeninfo?id_token={payload.token}"
                )
                if res.status_code == 200:
                    data = res.json()
                    verified_email = data.get("email")
                    verified_name = data.get("name")
                    verified_google_id = data.get("sub")
        except Exception as e:
            import logging
            logging.getLogger("artisan_ai").warning("Google tokeninfo check failed: %s", e)

    if not verified_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication failed: Valid Google access_token or id_token is required and must be verified by Google.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    email = verified_email.strip().lower()
    name = (verified_name or email.split("@")[0]).strip()
    google_id = verified_google_id or f"google_{email}"

    # Check if user already exists
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Create new user registered via verified Google OAuth
        # New users default strictly to BUYER role (prevent client role escalation)
        user_name = name if name else email.split("@")[0].capitalize()
        user = User(
            name=user_name,
            email=email,
            phone=None,
            hashed_password=hash_password(f"google_oauth_{google_id}_secret"),
            role="BUYER",
            active_mode="BUY",
            location="India",
            craft="Connoisseur Collection"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token({
        "sub": str(user.id),
        "name": user.name,
        "role": user.role,
        "ver": user.token_version or 1
    })

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )

@router.post("/reset-password", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def reset_password_disabled():
    """
    Public password reset via email/phone is disabled.

    A secure reset flow requires a cryptographically signed one-time token
    delivered through a verified channel (SMS OTP / email link) with
    server-side expiry. That infrastructure is not yet implemented.

    To change your password, use POST /api/auth/change-password with a
    valid Bearer token and your current password.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "Password reset by email/phone is not available. "
            "A secure OTP/email-verified reset flow has not been implemented yet. "
            "If you are logged in, use POST /api/auth/change-password instead."
        )
    )

@router.post("/change-password", response_model=TokenResponse)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_strict)
):
    """
    Authenticated password change.
    Identity is sourced exclusively from the Bearer JWT — no email/phone accepted.
    Verifies current_password before accepting new_password.
    Increments token_version to invalidate prior JWT sessions.
    Returns a fresh JWT token on success.
    """
    rate_limiter.check_rate_limit(f"chpwd:{get_client_identifier(request, current_user.id)}", max_requests=5, window_seconds=60)
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )

    current_user.hashed_password = hash_password(payload.new_password)
    current_user.token_version = (current_user.token_version or 1) + 1
    db.commit()
    db.refresh(current_user)

    access_token = create_access_token({
        "sub": str(current_user.id),
        "name": current_user.name,
        "role": current_user.role,
        "ver": current_user.token_version
    })

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=current_user
    )

@router.get("/me", response_model=UserResponse)
def get_authenticated_user(current_user: User = Depends(get_current_user_strict)):
    """
    Returns the currently authenticated user based on Bearer token.
    """
    return current_user
