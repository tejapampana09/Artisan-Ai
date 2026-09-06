from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.database import get_db
from backend.app.models import User
from backend.app.schemas import UserRegister, UserLogin, ResetPasswordRequest, ChangePasswordRequest, TokenResponse, UserResponse
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

    user_role = (payload.role or "ARTISAN").upper()
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
    user = db.query(User).filter(
        or_(
            User.email == identifier.lower(),
            User.phone == identifier
        )
    ).first()

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
