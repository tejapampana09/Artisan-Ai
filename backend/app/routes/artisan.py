from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database import get_db
from backend.app.models import User, Product, Review
from backend.app.schemas import ArtisanProfileResponse, ArtisanProfileUpdate, ProductResponse
from backend.app.services.auth import get_current_user

router = APIRouter(prefix="/api/artisan", tags=["Artisan Profile & Verification"])

@router.get("/{artisan_id}", response_model=ArtisanProfileResponse)
def get_artisan_public_profile(artisan_id: int, db: Session = Depends(get_db)):
    """Fetch public master artisan profile details, experience, verification status, and average rating."""
    artisan = db.query(User).filter(User.id == artisan_id).first()
    if not artisan:
        raise HTTPException(status_code=404, detail="Master Artisan profile not found")

    prods_count = db.query(Product).filter(Product.seller_id == artisan_id).count()
    
    # Calculate average review rating across artisan's products
    product_ids = [p.id for p in db.query(Product.id).filter(Product.seller_id == artisan_id).all()]
    avg_rating = 0.0
    if product_ids:
        avg_res = db.query(func.avg(Review.rating)).filter(Review.product_id.in_(product_ids)).scalar()
        if avg_res:
            avg_rating = round(float(avg_res), 1)

    # Trust Verification Status logic
    ver_status = artisan.verification_status or "UNVERIFIED"
    if ver_status == "UNVERIFIED" and artisan.bio and artisan.craft:
        ver_status = "PROFILE_COMPLETE"

    return ArtisanProfileResponse(
        id=artisan.id,
        name=artisan.name,
        email=None,  # Protect private email from public profiling
        phone=None,  # Protect private phone from public profiling
        location=artisan.location or "India",
        craft=artisan.craft or "Handicrafts",
        avatar_url=artisan.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={artisan.name}",
        bio=artisan.bio or f"Master artisan specializing in traditional {artisan.craft or 'handicrafts'}.",
        craft_specialization=artisan.craft_specialization or artisan.craft or "Handicrafts",
        experience_years=artisan.experience_years or 5,
        verification_status=ver_status,
        total_products_count=prods_count,
        average_rating=avg_rating
    )

@router.put("/profile", response_model=ArtisanProfileResponse)
def update_artisan_profile(
    req: ArtisanProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates current artisan profile details."""
    if req.avatar_url is not None:
        current_user.avatar_url = req.avatar_url
    if req.bio is not None:
        current_user.bio = req.bio
    if req.craft_specialization is not None:
        current_user.craft_specialization = req.craft_specialization
    if req.experience_years is not None:
        current_user.experience_years = req.experience_years
    if req.location is not None:
        current_user.location = req.location

    # Auto-update status to PROFILE_COMPLETE if basic fields filled
    if current_user.verification_status == "UNVERIFIED" and current_user.bio:
        current_user.verification_status = "PROFILE_COMPLETE"

    db.commit()
    db.refresh(current_user)

    return get_artisan_public_profile(current_user.id, db)
