from typing import List, Optional, cast
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Product, User
from backend.app.schemas import ProductCreate, ProductUpdate, ProductResponse
from backend.app.services.auth import require_artisan, get_optional_current_user

from decimal import Decimal

router = APIRouter(prefix="/api/products", tags=["Products"])

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate, 
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan)
):
    """Creates a new product belonging strictly to the authenticated Artisan, defaulting to DRAFT."""
    product_data = product_in.model_dump()
    product_data["seller_id"] = current_artisan.id
    if not product_data.get("status"):
        product_data["status"] = "DRAFT"

    money_fields = ["price", "material_cost", "labour_cost", "packaging_cost", "other_cost"]
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
    search: Optional[str] = Query(None, description="Multi-field search across title, description, materials, category, story"),
    min_price: Optional[float] = Query(None, ge=0.0),
    max_price: Optional[float] = Query(None, ge=0.0),
    db: Session = Depends(get_db)
):
    """
    Lists products. If querying for marketplace (no seller_id specified),
    only PUBLISHED products are returned by default.
    """
    query = db.query(Product)
    if category:
        query = query.filter(Product.category == category)
    if status:
        query = query.filter(Product.status == status)
    elif seller_id is None:
        # Public marketplace listing: enforce PUBLISHED only
        query = query.filter(Product.status == "PUBLISHED")

    if seller_id:
        query = query.filter(Product.seller_id == seller_id)
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (Product.title.ilike(term)) |
            (Product.description.ilike(term)) |
            (Product.category.ilike(term)) |
            (Product.materials.ilike(term)) |
            (Product.craft_story.ilike(term))
        )
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
    current_artisan: User = Depends(require_artisan)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    # Strict artisan ownership check
    if product.seller_id != current_artisan.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify another artisan's product."
        )

    update_data = product_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ["price", "material_cost", "labour_cost", "packaging_cost", "other_cost"] and value is not None:
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
    current_artisan: User = Depends(require_artisan)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    # Strict artisan ownership check
    if product.seller_id != current_artisan.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete another artisan's product."
        )

    db.delete(product)
    db.commit()
    return None

VALID_LIFECYCLE_STATES = ["DRAFT", "AI_PROCESSING", "AI_GENERATED", "APPROVED", "PUBLISHED"]
VALID_TRANSITIONS = {
    "DRAFT": ["AI_PROCESSING", "APPROVED", "PUBLISHED"],
    "AI_PROCESSING": ["AI_GENERATED", "DRAFT"],
    "AI_GENERATED": ["APPROVED", "DRAFT", "AI_PROCESSING"],
    "APPROVED": ["PUBLISHED", "DRAFT"],
    "PUBLISHED": ["APPROVED", "DRAFT"]
}

@router.patch("/{product_id}/status", response_model=ProductResponse)
def transition_product_status(
    product_id: int,
    status_payload: dict,
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    # Strict artisan ownership check
    if product.seller_id != current_artisan.id:
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

    current_status = (product.status or "DRAFT").upper()
    valid_next_states = VALID_TRANSITIONS.get(current_status, VALID_LIFECYCLE_STATES)
    if new_status != current_status and new_status not in valid_next_states:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid lifecycle state transition from '{current_status}' to '{new_status}'. Allowed transitions: {', '.join(valid_next_states)}"
        )

    product.status = new_status
    db.commit()
    db.refresh(product)
    return product
