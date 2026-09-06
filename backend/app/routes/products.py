from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Product, User
from backend.app.schemas import ProductCreate, ProductUpdate, ProductResponse
from backend.app.services.auth import get_current_user
from backend.app.seed import seed_sample_products, SAMPLE_PRODUCTS
from backend.app.config import DEMO_MODE

from decimal import Decimal

router = APIRouter(prefix="/api/products", tags=["Products"])

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Prevent seller spoofing: non-admin users cannot assign products to other sellers
    if current_user.role == "ADMIN" and product_in.seller_id:
        seller_id = product_in.seller_id
    else:
        seller_id = current_user.id

    product_data = product_in.model_dump()
    product_data["seller_id"] = seller_id

    money_fields = ["price", "material_cost", "labour_cost", "packaging_cost"]
    for f in money_fields:
        if f in product_data and product_data[f] is not None:
            product_data[f] = Decimal(str(product_data[f])).quantize(Decimal("0.01"))
    if "min_margin_pct" in product_data and product_data["min_margin_pct"] is not None:
        product_data["min_margin_pct"] = Decimal(str(product_data["min_margin_pct"])).quantize(Decimal("0.0001"))

    product = Product(**product_data)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@router.get("", response_model=List[ProductResponse])
def list_products(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    seller_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    # Ensure baseline sample products exist only in demo mode
    if DEMO_MODE and db.query(Product).count() < len(SAMPLE_PRODUCTS):
        seed_sample_products(db, seller_id or 1)

    query = db.query(Product)
    if category:
        query = query.filter(Product.category == category)
    if status:
        query = query.filter(Product.status == status)
    if seller_id:
        query = query.filter(Product.seller_id == seller_id)
    return query.order_by(Product.id.desc()).all()

@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )
    return product

@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    # Seller Ownership Validation
    if product.seller_id and current_user.id and product.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify another artisan's product."
        )

    update_data = product_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ["price", "material_cost", "labour_cost", "packaging_cost"] and value is not None:
            value = Decimal(str(value)).quantize(Decimal("0.01"))
        elif field == "min_margin_pct" and value is not None:
            value = Decimal(str(value)).quantize(Decimal("0.0001"))
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    # Seller Ownership Validation
    if product.seller_id and current_user.id and product.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete another artisan's product."
        )

    db.delete(product)
    db.commit()
    return None

VALID_LIFECYCLE_STATES = ["DRAFT", "AI_PROCESSING", "AI_GENERATED", "APPROVED", "PUBLISHED"]

@router.patch("/{product_id}/status", response_model=ProductResponse)
def transition_product_status(
    product_id: int,
    status_payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    # Seller Ownership Validation
    if product.seller_id and current_user.id and product.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to transition status of another artisan's product."
        )
    
    new_status = status_payload.get("status", "").upper()
    if new_status not in VALID_LIFECYCLE_STATES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{new_status}'. Must be one of: {', '.join(VALID_LIFECYCLE_STATES)}"
        )

    product.status = new_status
    db.commit()
    db.refresh(product)
    return product
