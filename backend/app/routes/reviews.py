from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database import get_db
from backend.app.models import Review, Product, Order, User, Notification
from backend.app.schemas import ReviewCreate, ReviewResponse
from backend.app.services.auth import get_current_user

router = APIRouter(prefix="/api", tags=["Verified Reviews & Ratings"])

@router.get("/products/{product_id}/reviews", response_model=List[ReviewResponse])
def get_product_reviews(product_id: int, db: Session = Depends(get_db)):
    """Fetch verified buyer reviews for a specific craft product."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    reviews = db.query(Review).filter(Review.product_id == product_id).order_by(Review.created_at.desc()).all()
    return [
        ReviewResponse(
            id=r.id,
            product_id=r.product_id,
            order_id=r.order_id,
            buyer_id=r.buyer_id,
            buyer_name=r.buyer_name,
            rating=r.rating,
            comment=r.comment,
            verified_purchase=bool(r.verified_purchase),
            created_at=r.created_at
        ) for r in reviews
    ]

@router.post("/products/{product_id}/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_product_review(
    product_id: int,
    req: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits a verified buyer review.
    Validates that the buyer has a completed DELIVERED order for this product.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Prevent sellers from reviewing their own products
    if product.seller_id and product.seller_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sellers cannot review their own products (ఉత్పత్తిదారులు వారి సొంత ఉత్పత్తులకు సమీక్షలు ఇవ్వలేరు)"
        )

    # Validate supplied order_id if explicitly provided; otherwise use verified delivered order
    if req.order_id is not None:
        target_order = db.query(Order).filter(
            Order.id == req.order_id,
            Order.product_id == product_id,
            Order.user_id == current_user.id,
            Order.status == "DELIVERED"
        ).first()
        if not target_order:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid order_id: The supplied order_id must belong to your completed DELIVERED order for this product."
            )
    else:
        target_order = db.query(Order).filter(
            Order.product_id == product_id,
            Order.user_id == current_user.id,
            Order.status == "DELIVERED"
        ).first()

    if not target_order:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only verified buyers who have received delivery of this product can submit reviews."
        )

    # Primary Business Rule: One review per delivered order
    existing_review = db.query(Review).filter(Review.order_id == target_order.id).first()
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A review has already been submitted for this order."
        )

    review = Review(
        product_id=product_id,
        order_id=target_order.id,
        buyer_id=current_user.id,
        buyer_name=current_user.name,
        rating=req.rating,
        comment=req.comment,
        verified_purchase=1
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    # Trigger notification for seller
    if product.seller_id:
        notif = Notification(
            user_id=product.seller_id,
            title="⭐ New Verified Craft Review!",
            message=f"{current_user.name} rated '{product.title}' {req.rating}/5 stars: '{req.comment or 'Great craft!'}'",
            type="REVIEW"
        )
        db.add(notif)
        db.commit()

    return ReviewResponse(
        id=review.id,
        product_id=review.product_id,
        order_id=review.order_id,
        buyer_id=review.buyer_id,
        buyer_name=review.buyer_name,
        rating=review.rating,
        comment=review.comment,
        verified_purchase=bool(review.verified_purchase),
        created_at=review.created_at
    )
