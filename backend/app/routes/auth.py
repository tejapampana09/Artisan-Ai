from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.database import get_db
from backend.app.models import User
from backend.app.schemas import UserRegister, UserLogin, ResetPasswordRequest, TokenResponse, UserResponse
from backend.app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_strict,
    get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegister, db: Session = Depends(get_db)):
    """
    Registers a new artisan or buyer with secure password hashing.
    Generates and returns a JWT access token.
    """
    # Check if user with given email or phone exists
    filters = []
    if payload.email:
        filters.append(User.email == payload.email)
    if payload.phone:
        filters.append(User.phone == payload.phone)

    if filters:
        existing = db.query(User).filter(or_(*filters)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email or phone number is already registered."
            )

    new_user = User(
        name=payload.name.strip(),
        email=payload.email.strip().lower() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        hashed_password=hash_password(payload.password),
        role=(payload.role or "ARTISAN").upper(),
        active_mode=payload.active_mode or "SELL",
        location=payload.location or "India",
        craft=payload.craft or "Handcrafted Goods"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token({
        "sub": str(new_user.id),
        "name": new_user.name,
        "role": new_user.role
    })

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=new_user
    )

@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticates a user via email or phone number and password.
    Returns JWT access token.
    """
    identifier = payload.email_or_phone.strip()
    user = db.query(User).filter(
        or_(
            User.email == identifier.lower(),
            User.phone == identifier
        )
    ).first()

    if not user or not user.hashed_password:
        # Check if default demo user is being logged in without password
        if user and not user.hashed_password and payload.password == "artisan123":
            # Allow demo user initial password set
            user.hashed_password = hash_password(payload.password)
            db.commit()
        else:
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
        "role": user.role
    })

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )

@router.post("/reset-password", response_model=TokenResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Resets password for an existing account identified by email or phone.
    Returns a fresh JWT token for seamless sign-in.
    """
    identifier = payload.email_or_phone.strip()
    user = db.query(User).filter(
        or_(
            User.email == identifier.lower(),
            User.phone == identifier
        )
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email or phone number. Please check or create a new account."
        )

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    db.refresh(user)

    access_token = create_access_token({
        "sub": str(user.id),
        "name": user.name,
        "role": user.role
    })

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )

@router.get("/me", response_model=UserResponse)
def get_authenticated_user(current_user: User = Depends(get_current_user_strict)):
    """
    Returns the currently authenticated user based on Bearer token.
    """
    return current_user
