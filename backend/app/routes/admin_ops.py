from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.database import get_db
from backend.app.models import (
    User, Product, Event, PricingDecision,
    Notification, Order, Payment, Enquiry, Review,
    ProcessedOperation, DraftCatalog
)
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

    # Enforce uniqueness for email or phone
    existing_user = db.query(User).filter(
        or_(
            (User.email == clean_email) if clean_email else False,
            (User.phone == clean_phone) if clean_phone else False
        )
    ).first()

    if existing_user:
        conflict_field = "Email" if (clean_email and existing_user.email == clean_email) else "Phone number"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{conflict_field} is already registered on the platform."
        )

    seller = User(
        name=payload.name.strip(),
        email=clean_email,
        phone=clean_phone,
        hashed_password=hash_password(payload.password),
        role="ARTISAN",
        status="ACTIVE",
        location=payload.location.strip() if payload.location else None,
        craft=payload.craft.strip() if payload.craft else None,
        craft_specialization=payload.craft.strip() if payload.craft else None,
        verification_status=payload.verification_status,
        experience_years=payload.experience_years
    )
    db.add(seller)
    db.commit()
    db.refresh(seller)
    return seller

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
    Safely cascades removal of draft catalogs, processed operations, notifications,
    events, reviews, enquiries, pricing decisions, orders, and products.
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

    try:
        # 1. Clean ProcessedOperations and DraftCatalogs
        db.query(ProcessedOperation).filter(ProcessedOperation.user_id == artisan.id).delete(synchronize_session=False)
        db.query(DraftCatalog).filter(DraftCatalog.user_id == artisan.id).delete(synchronize_session=False)

        # 2. Clean Notifications
        db.query(Notification).filter(Notification.user_id == artisan.id).delete(synchronize_session=False)

        # 3. Clean Events for artisan
        db.query(Event).filter(Event.user_id == artisan.id).delete(synchronize_session=False)

        # 4. Clean Enquiries made by artisan
        db.query(Enquiry).filter(Enquiry.user_id == artisan.id).delete(synchronize_session=False)

        # 5. Clean Reviews made by artisan
        db.query(Review).filter(Review.buyer_id == artisan.id).delete(synchronize_session=False)

        # 6. Orders placed by artisan (if any)
        user_orders = db.query(Order).filter(Order.user_id == artisan.id).all()
        user_order_ids = [o.id for o in user_orders]
        if user_order_ids:
            db.query(Payment).filter(Payment.order_id.in_(user_order_ids)).delete(synchronize_session=False)
            db.query(Review).filter(Review.order_id.in_(user_order_ids)).delete(synchronize_session=False)
            db.query(Order).filter(Order.id.in_(user_order_ids)).delete(synchronize_session=False)

        # 7. Products belonging to this artisan and all dependent records
        products = db.query(Product).filter(Product.seller_id == artisan.id).all()
        prod_ids = [p.id for p in products]
        if prod_ids:
            db.query(PricingDecision).filter(PricingDecision.product_id.in_(prod_ids)).delete(synchronize_session=False)
            db.query(Event).filter(Event.product_id.in_(prod_ids)).delete(synchronize_session=False)
            db.query(Enquiry).filter(Enquiry.product_id.in_(prod_ids)).delete(synchronize_session=False)
            db.query(Review).filter(Review.product_id.in_(prod_ids)).delete(synchronize_session=False)

            prod_orders = db.query(Order).filter(Order.product_id.in_(prod_ids)).all()
            prod_order_ids = [o.id for o in prod_orders]
            if prod_order_ids:
                db.query(Payment).filter(Payment.order_id.in_(prod_order_ids)).delete(synchronize_session=False)
                db.query(Review).filter(Review.order_id.in_(prod_order_ids)).delete(synchronize_session=False)
                db.query(Order).filter(Order.id.in_(prod_order_ids)).delete(synchronize_session=False)

            for prod in products:
                db.delete(prod)

        # 8. Delete the artisan User record
        db.delete(artisan)
        db.commit()

        return {
            "status": "success",
            "message": f"Artisan '{artisan_name}' (ID: {artisan_id}) and catalog data removed successfully."
        }
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete artisan due to database error: {str(exc)}"
        )
