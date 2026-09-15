import re
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.database import get_db
from backend.app.models import User
from backend.app.schemas import (
    UserLogin,
    ChangePasswordRequest,
    TokenResponse,
    UserResponse,
    UserUpdate
)
from backend.app.services.auth import (
    hash_password,
    verify_password,
    create_domain_token,
    require_admin
)
from backend.app.services.rate_limiter import rate_limiter, get_client_identifier

logger = logging.getLogger("artisan_ai.admin_auth")
router = APIRouter(prefix="/api/admin/auth", tags=["Admin Console Authentication"])

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

@router.post("/login", response_model=TokenResponse)
def login_admin(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    """
    Authenticates an Administrator into the Admin Console.
    Public registration is strictly impossible.
    Rejects Buyer and Artisan accounts with 403.
    """
    rate_limiter.check_rate_limit(f"login_admin:{get_client_identifier(request)}", max_requests=5, window_seconds=60)
    identifier = payload.email_or_phone.strip()
    match_conditions = _phone_lookup_filters(identifier)

    user = db.query(User).filter(or_(*match_conditions)).first()

    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your administrative credentials."
        )

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your administrative credentials."
        )

    if user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Account does not possess Administrator privileges."
        )

    if getattr(user, "status", "ACTIVE") != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator account is suspended or disabled."
        )

    access_token = create_domain_token(
        user=user,
        auth_domain="ADMIN",
        session_type="ADMIN"
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        auth_domain="ADMIN",
        session_type="ADMIN",
        user=user
    )

@router.get("/me", response_model=UserResponse)
def get_admin_me(current_admin: User = Depends(require_admin)):
    """
    Returns authenticated Administrator details.
    Enforces Admin domain token.
    """
    return current_admin

@router.put("/me", response_model=UserResponse)
def update_admin_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Updates authenticated Administrator profile details (name, phone, location, etc.).
    """
    if payload.name is not None and payload.name.strip():
        current_admin.name = payload.name.strip()
    if payload.phone is not None:
        current_admin.phone = payload.phone.strip() if payload.phone.strip() else None
    if payload.location is not None:
        current_admin.location = payload.location.strip() if payload.location.strip() else None
    if payload.craft is not None:
        current_admin.craft = payload.craft.strip() if payload.craft.strip() else None
    if payload.avatar_url is not None:
        current_admin.avatar_url = payload.avatar_url
    if payload.bio is not None:
        current_admin.bio = payload.bio

    db.commit()
    db.refresh(current_admin)
    return current_admin

@router.post("/change-password", response_model=TokenResponse)
def change_admin_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Changes password for authenticated Administrator. Invalidates previous sessions.
    """
    rate_limiter.check_rate_limit(f"chpwd_admin:{get_client_identifier(request, current_admin.id)}", max_requests=5, window_seconds=60)
    if not verify_password(payload.current_password, current_admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )

    current_admin.hashed_password = hash_password(payload.new_password)
    current_admin.token_version = (current_admin.token_version or 1) + 1
    db.commit()
    db.refresh(current_admin)

    access_token = create_domain_token(
        user=current_admin,
        auth_domain="ADMIN",
        session_type="ADMIN"
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        auth_domain="ADMIN",
        session_type="ADMIN",
        user=current_admin
    )
