import re
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.database import get_db
from backend.app.models import User
from backend.app.schemas import (
    UserRegister,
    UserLogin,
    ChangePasswordRequest,
    TokenResponse,
    UserResponse,
    GoogleAuthRequest
)
from backend.app.services.auth import (
    hash_password,
    verify_password,
    create_domain_token,
    require_buyer
)
from backend.app.services.rate_limiter import rate_limiter, get_client_identifier

logger = logging.getLogger("artisan_ai.marketplace_auth")
router = APIRouter(prefix="/api/marketplace/auth", tags=["Marketplace Authentication"])

def _phone_lookup_filters(identifier: str):
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
    return match_conditions

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_buyer(payload: UserRegister, request: Request, db: Session = Depends(get_db)):
    """
    Registers a new Marketplace Buyer account.
    Artisans cannot self-register here; this portal is strictly for Buyers.
    """
    rate_limiter.check_rate_limit(f"reg_buyer:{get_client_identifier(request)}", max_requests=5, window_seconds=60)

    clean_email = payload.email.strip().lower() if (payload.email and payload.email.strip()) else None
    clean_phone = payload.phone.strip() if (payload.phone and payload.phone.strip()) else None

    if not clean_email and not clean_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide an email address or phone number for registration."
        )

    filters = []
    if clean_email:
        filters.append(User.email == clean_email)
    if clean_phone:
        filters.append(User.phone == clean_phone)

    if filters:
        existing = db.query(User).filter(or_(*filters)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email or phone number is already registered."
            )

    new_user = User(
        name=payload.name.strip(),
        email=clean_email,
        phone=clean_phone,
        hashed_password=hash_password(payload.password),
        role="BUYER",
        status="ACTIVE",
        location=payload.location or "India",
        craft="Connoisseur Collection"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_domain_token(
        user=new_user,
        auth_domain="MARKETPLACE",
        session_type="BUYER"
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        auth_domain="MARKETPLACE",
        session_type="BUYER",
        user=new_user
    )

@router.post("/login", response_model=TokenResponse)
def login_buyer(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    """
    Authenticates a Marketplace Buyer using email/phone and password.
    Rejects Artisan and Administrator accounts with 403.
    """
    rate_limiter.check_rate_limit(f"login_buyer:{get_client_identifier(request)}", max_requests=5, window_seconds=60)
    identifier = payload.email_or_phone.strip()
    match_conditions = _phone_lookup_filters(identifier)

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

    if user.role != "BUYER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. This account is registered as {user.role}. Marketplace sign-in is strictly for Buyers."
        )

    if getattr(user, "status", "ACTIVE") != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Buyer account is suspended or inactive."
        )

    access_token = create_domain_token(
        user=user,
        auth_domain="MARKETPLACE",
        session_type="BUYER"
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        auth_domain="MARKETPLACE",
        session_type="BUYER",
        user=user
    )

@router.post("/google", response_model=TokenResponse)
def google_auth_buyer(payload: GoogleAuthRequest, request: Request, db: Session = Depends(get_db)):
    """
    Authenticates or registers a Buyer via verified Google OAuth.
    Only creates/logs into BUYER accounts.
    """
    rate_limiter.check_rate_limit(f"google_buyer:{get_client_identifier(request)}", max_requests=10, window_seconds=60)

    verified_email = None
    verified_name = None
    verified_google_id = None

    import httpx
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
            logger.warning("Google userinfo token check failed: %s", e)

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
            logger.warning("Google tokeninfo check failed: %s", e)

    if not verified_email:
        from backend.app.config import DEMO_MODE, ENVIRONMENT
        if (DEMO_MODE or ENVIRONMENT != "production") and payload.email and "@" in payload.email:
            verified_email = payload.email.strip().lower()
            verified_name = payload.name or payload.email.split("@")[0]
            verified_google_id = payload.google_id or f"dev_google_{payload.email}"
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google authentication failed: Valid Google access_token or id_token required.",
                headers={"WWW-Authenticate": "Bearer"}
            )

    email = verified_email.strip().lower()
    name = (verified_name or email.split("@")[0]).strip()
    google_id = verified_google_id or f"google_{email}"

    user = db.query(User).filter(User.email == email).first()

    if not user:
        user = User(
            name=name if name else email.split("@")[0].capitalize(),
            email=email,
            phone=None,
            hashed_password=hash_password(f"google_oauth_{google_id}_secret"),
            role="BUYER",
            status="ACTIVE",
            location="India",
            craft="Connoisseur Collection"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if user.role != "BUYER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account '{email}' is registered as {user.role}. Marketplace sign-in is strictly reserved for Buyers. Please sign in via the Artisan Studio or Admin Console."
            )
        if getattr(user, "status", "ACTIVE") != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Buyer account is suspended or inactive."
            )

    access_token = create_domain_token(
        user=user,
        auth_domain="MARKETPLACE",
        session_type="BUYER"
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        auth_domain="MARKETPLACE",
        session_type="BUYER",
        user=user
    )

@router.get("/me", response_model=UserResponse)
def get_buyer_me(current_buyer: User = Depends(require_buyer)):
    """
    Returns current authenticated Buyer details.
    Enforces Marketplace domain token.
    """
    return current_buyer

@router.post("/change-password", response_model=TokenResponse)
def change_buyer_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_buyer: User = Depends(require_buyer)
):
    """
    Changes password for authenticated Buyer. Invalidation is atomic via token_version.
    """
    rate_limiter.check_rate_limit(f"chpwd_buyer:{get_client_identifier(request, current_buyer.id)}", max_requests=5, window_seconds=60)
    if not verify_password(payload.current_password, current_buyer.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )

    current_buyer.hashed_password = hash_password(payload.new_password)
    current_buyer.token_version = (current_buyer.token_version or 1) + 1
    db.commit()
    db.refresh(current_buyer)

    access_token = create_domain_token(
        user=current_buyer,
        auth_domain="MARKETPLACE",
        session_type="BUYER"
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        auth_domain="MARKETPLACE",
        session_type="BUYER",
        user=current_buyer
    )
