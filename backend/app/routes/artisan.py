from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database import get_db
from backend.app.models import User, Product, Review
from backend.app.schemas import ArtisanProfileResponse, ArtisanProfileUpdate, ProductResponse, UserResponse, AdminCreateSellerRequest
from backend.app.services.auth import get_current_user, require_admin

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

@router.post("/admin/create-seller", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def admin_create_seller(
    payload: AdminCreateSellerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Admin Dashboard Endpoint: Allows Admin / Master Coordinator to create verified seller profiles
    and assign login credentials for artisans. Strictly protected by require_admin.
    """
    from backend.app.services.auth import hash_password

    clean_email = payload.email.strip().lower() if (payload.email and payload.email.strip()) else None
    clean_phone = payload.phone.strip() if (payload.phone and payload.phone.strip()) else None

    if not clean_email and not clean_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide at least an email address or phone number for the artisan seller profile."
        )

    # Check for duplicate email/phone
    filters = []
    if clean_email:
        filters.append(User.email == clean_email)
    if clean_phone:
        filters.append(User.phone == clean_phone)

    if filters:
        from sqlalchemy import or_
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
        active_mode="SELL",
        location=payload.location or "India",
        craft=payload.craft or "Handicrafts",
        bio=payload.bio or f"Master artisan specializing in traditional {payload.craft or 'handicrafts'}.",
        verification_status=payload.verification_status or "UNVERIFIED"
    )
    db.add(new_seller)
    db.commit()
    db.refresh(new_seller)

    return new_seller

@router.get("/admin/sellers", response_model=List[UserResponse])
def admin_list_sellers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Lists all registered verified artisan seller profiles. Strictly protected by require_admin."""
    return db.query(User).filter(User.role == "ARTISAN").all()


@router.get("/admin/system-accounts")
def admin_get_system_accounts(
    db: Session = Depends(get_db),
    x_admin_secret: Optional[str] = Header(None)
):
    """Fetches all system accounts (Admins & Artisans) from the active database."""
    from backend.app.config import JWT_SECRET_KEY
    if not x_admin_secret or x_admin_secret != JWT_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin secret authorization.")

    admins = db.query(User).filter(User.role == "ADMIN").all()
    artisans = db.query(User).filter(User.role == "ARTISAN").all()
    buyers_count = db.query(User).filter(User.role == "BUYER").count()

    return {
        "status": "success",
        "admins": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone": u.phone,
                "role": u.role,
                "verification_status": u.verification_status
            }
            for u in admins
        ],
        "artisans": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone": u.phone,
                "role": u.role,
                "craft": u.craft,
                "location": u.location,
                "verification_status": u.verification_status
            }
            for u in artisans
        ],
        "buyers_count": buyers_count
    }


@router.post("/admin/cleanup-buyers")
def admin_cleanup_buyers(
    db: Session = Depends(get_db),
    x_admin_secret: Optional[str] = Header(None)
):
    """
    Cleans up all BUYER accounts and their associated order/notification/enquiry/event records from active database.
    Retains all ADMIN and ARTISAN accounts intact.
    """
    from backend.app.config import JWT_SECRET_KEY
    from backend.app.models import Order, Notification, Enquiry, Event, Review
    if not x_admin_secret or x_admin_secret != JWT_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin secret authorization.")

    buyer_ids = [u.id for u in db.query(User.id).filter(User.role == "BUYER").all()]
    deleted_count = len(buyer_ids)

    if buyer_ids:
        db.query(Notification).filter(Notification.user_id.in_(buyer_ids)).delete(synchronize_session=False)
        db.query(Event).filter(Event.user_id.in_(buyer_ids)).delete(synchronize_session=False)
        db.query(Enquiry).filter(Enquiry.user_id.in_(buyer_ids)).delete(synchronize_session=False)
        db.query(Review).filter(Review.buyer_id.in_(buyer_ids)).delete(synchronize_session=False)
        db.query(Order).filter(Order.user_id.in_(buyer_ids)).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_(buyer_ids)).delete(synchronize_session=False)
        db.commit()

    admins = db.query(User).filter(User.role == "ADMIN").all()
    artisans = db.query(User).filter(User.role == "ARTISAN").all()

    return {
        "status": "success",
        "deleted_buyers_count": deleted_count,
        "admins": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone": u.phone,
                "role": u.role,
                "verification_status": u.verification_status
            }
            for u in admins
        ],
        "artisans": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone": u.phone,
                "role": u.role,
                "craft": u.craft,
                "location": u.location,
                "verification_status": u.verification_status
            }
            for u in artisans
        ]
    }
