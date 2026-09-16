from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.database import get_db
from backend.app.models import User, Product, Event, PricingDecision
from backend.app.schemas import AdminCreateSellerRequest, UserResponse, AdminResetArtisanPasswordRequest
from backend.app.services.auth import require_admin, hash_password

admin_ops_router = APIRouter(prefix="/api/admin", tags=["Admin Console Management"])

@admin_ops_router.post("/artisans", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def admin_create_artisan(
    payload: AdminCreateSellerRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    V3 Canonical Admin Endpoint: Provision a verified artisan seller profile
    with initial credentials. Strictly accessible only with an ADMIN domain token.
    """
    clean_email = payload.email.strip().lower() if (payload.email and payload.email.strip()) else None
    clean_phone = payload.phone.strip() if (payload.phone and payload.phone.strip()) else None

    if not clean_email and not clean_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide at least an email address or phone number for the artisan seller profile."
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
                detail="A seller profile with this email or phone number already exists."
            )

    new_seller = User(
        name=payload.name.strip(),
        email=clean_email,
        phone=clean_phone,
        hashed_password=hash_password(payload.password),
        role="ARTISAN",
        status="ACTIVE",
        location=payload.location or "India",
        craft=payload.craft or "Handicrafts",
        bio=payload.bio or f"Master artisan specializing in traditional {payload.craft or 'handicrafts'}.",
        verification_status=payload.verification_status or "UNVERIFIED"
    )
    db.add(new_seller)
    db.commit()
    db.refresh(new_seller)
    return new_seller

@admin_ops_router.get("/artisans", response_model=List[UserResponse])
def admin_list_artisans(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """Lists all registered artisan sellers. Strictly protected by require_admin."""
    return db.query(User).filter(User.role == "ARTISAN").all()

@admin_ops_router.post("/artisans/{artisan_id}/reset-password")
def admin_reset_artisan_password(
    artisan_id: int,
    payload: AdminResetArtisanPasswordRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Admin resets password for an artisan seller.
    Immediately increments token_version to invalidate prior session tokens.
    """
    artisan = db.query(User).filter(User.id == artisan_id).first()
    if not artisan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artisan not found."
        )
    if artisan.role != "ARTISAN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target user account is not an artisan."
        )

    artisan.hashed_password = hash_password(payload.new_password)
    artisan.token_version = (artisan.token_version or 1) + 1
    db.commit()

    return {
        "status": "success",
        "message": f"Password for artisan '{artisan.name}' has been reset successfully.",
        "artisan_id": artisan.id
    }

@admin_ops_router.delete("/artisans/{artisan_id}")
def admin_delete_artisan(
    artisan_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Admin permanently deletes an artisan seller profile and associated catalog data.
    """
    artisan = db.query(User).filter(User.id == artisan_id).first()
    if not artisan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artisan not found."
        )
    if artisan.role != "ARTISAN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target user account is not an artisan."
        )

    artisan_name = artisan.name

    # Dissociate or delete dependent records
    db.query(Event).filter(Event.user_id == artisan.id).delete(synchronize_session=False)

    products = db.query(Product).filter(Product.seller_id == artisan.id).all()
    for prod in products:
        db.query(PricingDecision).filter(PricingDecision.product_id == prod.id).delete(synchronize_session=False)
        db.query(Event).filter(Event.product_id == prod.id).delete(synchronize_session=False)
        db.delete(prod)

    db.delete(artisan)
    db.commit()

    return {
        "status": "success",
        "message": f"Artisan '{artisan_name}' (ID: {artisan_id}) and catalog data removed successfully."
    }
