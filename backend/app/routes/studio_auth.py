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
    require_artisan
)
from backend.app.services.rate_limiter import rate_limiter, get_client_identifier

logger = logging.getLogger("artisan_ai.studio_auth")
router = APIRouter(prefix="/api/studio/auth", tags=["Artisan Studio Authentication"])

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
def login_artisan(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    """
    Authenticates an Artisan into the Studio workspace.
    Public registration is prohibited; accounts must be admin-provisioned.
    Rejects Buyer and Administrator accounts with 403.
    """
    rate_limiter.check_rate_limit(f"login_studio:{get_client_identifier(request)}", max_requests=5, window_seconds=60)
    identifier = payload.email_or_phone.strip()
    match_conditions = _phone_lookup_filters(identifier)

    user = db.query(User).filter(or_(*match_conditions)).first()

    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your artisan email or phone number and password."
        )

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your artisan email or phone number and password."
        )

    if user.role != "ARTISAN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. This account is registered as {user.role}. Artisan Studio is strictly reserved for verified Artisans."
        )

    if getattr(user, "status", "ACTIVE") != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Artisan account is suspended or pending verification."
        )

    access_token = create_domain_token(
        user=user,
        auth_domain="ARTISAN_STUDIO",
        session_type="STUDIO"
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        auth_domain="ARTISAN_STUDIO",
        session_type="STUDIO",
        user=user
    )

@router.get("/me", response_model=UserResponse)
def get_artisan_me(current_artisan: User = Depends(require_artisan)):
    """
    Returns authenticated Artisan profile details.
    Enforces Artisan Studio domain token.
    """
    return current_artisan

@router.put("/me", response_model=UserResponse)
def update_artisan_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan)
):
    """
    Updates authenticated Artisan profile details (name, phone, location, craft, bio, etc.).
    """
    if payload.name is not None and payload.name.strip():
        current_artisan.name = payload.name.strip()
    if payload.phone is not None:
        current_artisan.phone = payload.phone.strip() if payload.phone.strip() else None
    if payload.location is not None:
        current_artisan.location = payload.location.strip() if payload.location.strip() else None
    if payload.craft is not None:
        current_artisan.craft = payload.craft.strip() if payload.craft.strip() else None
    if payload.avatar_url is not None:
        current_artisan.avatar_url = payload.avatar_url
    if payload.bio is not None:
        current_artisan.bio = payload.bio
    if payload.craft_specialization is not None:
        current_artisan.craft_specialization = payload.craft_specialization
    if payload.experience_years is not None:
        current_artisan.experience_years = payload.experience_years

    # Auto-update status to PROFILE_COMPLETE if basic fields filled
    if current_artisan.verification_status == "UNVERIFIED" and current_artisan.bio:
        current_artisan.verification_status = "PROFILE_COMPLETE"

    db.commit()
    db.refresh(current_artisan)
    return current_artisan

@router.post("/change-password", response_model=TokenResponse)
def change_artisan_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan)
):
    """
    Changes password for authenticated Artisan. Invalidates prior sessions via token_version.
    """
    rate_limiter.check_rate_limit(f"chpwd_studio:{get_client_identifier(request, current_artisan.id)}", max_requests=5, window_seconds=60)
    if not verify_password(payload.current_password, current_artisan.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )

    current_artisan.hashed_password = hash_password(payload.new_password)
    current_artisan.token_version = (current_artisan.token_version or 1) + 1
    db.commit()
    db.refresh(current_artisan)

    access_token = create_domain_token(
        user=current_artisan,
        auth_domain="ARTISAN_STUDIO",
        session_type="STUDIO"
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        auth_domain="ARTISAN_STUDIO",
        session_type="STUDIO",
        user=current_artisan
    )
