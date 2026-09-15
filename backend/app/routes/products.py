from typing import List, Optional, cast
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from decimal import Decimal

from backend.app.database import get_db
from backend.app.models import Product, User
from backend.app.schemas import ProductCreate, ProductUpdate, ProductResponse
from backend.app.services.auth import require_artisan, require_admin, get_optional_current_user

router = APIRouter(prefix="/api/products", tags=["Products"])

VALID_LIFECYCLE_STATES = ["DRAFT", "AI_PROCESSING", "AI_GENERATED", "PENDING_APPROVAL", "APPROVED", "PUBLISHED", "SUSPENDED"]
VALID_TRANSITIONS = {
    "DRAFT": ["AI_PROCESSING", "PENDING_APPROVAL", "APPROVED"],
    "AI_PROCESSING": ["AI_GENERATED", "DRAFT"],
    "AI_GENERATED": ["PENDING_APPROVAL", "DRAFT", "AI_PROCESSING"],
    "PENDING_APPROVAL": ["APPROVED", "DRAFT"],
    "APPROVED": ["PUBLISHED", "DRAFT"],
    "PUBLISHED": ["SUSPENDED", "DRAFT"],
    "SUSPENDED": ["DRAFT", "APPROVED", "PUBLISHED"]
}

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate, 
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan)
):
    """Creates a new product belonging strictly to the authenticated Artisan, defaulting to DRAFT."""
    if current_artisan.role != "ARTISAN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only registered Artisan sellers can create products."
        )

    product_data = product_in.model_dump()
    product_data["seller_id"] = current_artisan.id
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
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Lists products. Public buyers and unauthenticated callers can ONLY see PUBLISHED products.
    Draft/Unpublished leakage via ?status=DRAFT or ?seller_id=X is strictly blocked.
    """
    query = db.query(Product)

    is_admin = current_user and getattr(current_user, "role", None) == "ADMIN"
    is_self_seller = current_user and getattr(current_user, "role", None) == "ARTISAN" and (seller_id is None or current_user.id == seller_id)

    if is_admin:
        if status:
            query = query.filter(Product.status == status)
        if seller_id:
            query = query.filter(Product.seller_id == seller_id)
    elif is_self_seller:
        query = query.filter(Product.seller_id == current_user.id)
        if status:
            query = query.filter(Product.status == status)
    else:
        query = query.filter(Product.status == "PUBLISHED")
        if seller_id:
            query = query.filter(Product.seller_id == seller_id)

    if category:
        query = query.filter(Product.category == category)
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
def get_product(
    product_id: int, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Fetches a single product by ID. Non-published products return 404 for non-owner public callers."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )
    
    is_admin = current_user and getattr(current_user, "role", None) == "ADMIN"
    is_owner = current_user and current_user.id == product.seller_id

    if product.status != "PUBLISHED" and not (is_admin or is_owner):
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
    """Artisans can only edit their OWN products."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    if product.seller_id != current_artisan.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify another artisan's product."
        )

    update_data = product_in.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] is not None:
        target_status = str(update_data["status"]).upper()
        if target_status == "APPROVED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Platform Administrators can APPROVE products."
            )
        elif target_status == "PUBLISHED" and product.status != "APPROVED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Product must be APPROVED by admin before it can be PUBLISHED."
            )
        elif target_status == "PUBLISHED" and current_artisan.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Platform Administrators can PUBLISH products."
            )
        elif target_status == "SUSPENDED" and current_artisan.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Platform Administrators can SUSPEND products."
            )

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
    """Artisans can only delete their OWN products."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    if product.seller_id != current_artisan.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete another artisan's product."
        )

    db.delete(product)
    db.commit()
    return None

@router.patch("/{product_id}/status", response_model=ProductResponse)
def transition_product_status(
    product_id: int,
    status_payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_current_user)
):
    """
    Status transition with strict domain authority boundaries.
    Artisan: Can submit product for approval (DRAFT -> PENDING_APPROVAL).
    Admin: Can APPROVE, PUBLISH, or SUSPEND products.
    """
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    new_status = status_payload.get("status", "").upper()
    if new_status not in VALID_LIFECYCLE_STATES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{new_status}'. Must be one of: {', '.join(VALID_LIFECYCLE_STATES)}"
        )

    is_admin = current_user.role == "ADMIN"
    is_owner = current_user.role == "ARTISAN" and current_user.id == product.seller_id

    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify status of this product."
        )

    # Authority Boundary Rules
    if new_status == "APPROVED" and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Platform Administrators can APPROVE products."
        )
    if new_status == "PUBLISHED" and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Platform Administrators can PUBLISH products."
        )
    if new_status == "PUBLISHED" and product.status != "APPROVED" and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product must be APPROVED by admin before it can be PUBLISHED."
        )
    if new_status == "SUSPENDED" and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Platform Administrators can SUSPEND products."
        )

    product.status = new_status
    db.commit()
    db.refresh(product)
    return product

# Clean V3 Domain Product Routers
public_products_router = APIRouter(prefix="/api/public/products", tags=["Public Products"])
marketplace_products_router = APIRouter(prefix="/api/marketplace/products", tags=["Marketplace Products"])
studio_products_router = APIRouter(prefix="/api/studio/products", tags=["Studio Products"])
admin_products_router = APIRouter(prefix="/api/admin/products", tags=["Admin Products"])

# PUBLIC / MARKETPLACE DOMAIN ENDPOINTS
@public_products_router.get("", response_model=List[ProductResponse])
@marketplace_products_router.get("", response_model=List[ProductResponse])
def domain_list_public_products(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None, ge=0.0),
    max_price: Optional[float] = Query(None, ge=0.0),
    db: Session = Depends(get_db)
):
    return list_products(category=category, status=None, seller_id=None, search=search, min_price=min_price, max_price=max_price, db=db, current_user=None)

@public_products_router.get("/{product_id}", response_model=ProductResponse)
@marketplace_products_router.get("/{product_id}", response_model=ProductResponse)
def domain_get_public_product(product_id: int, db: Session = Depends(get_db)):
    return get_product(product_id=product_id, db=db, current_user=None)

# STUDIO DOMAIN ENDPOINTS (Artisan Seller Business Operations)
@studio_products_router.get("", response_model=List[ProductResponse])
def domain_studio_list_products(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan)
):
    return list_products(status=status, seller_id=current_artisan.id, db=db, current_user=current_artisan)

@studio_products_router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def domain_studio_create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan)
):
    return create_product(product_in=product_in, db=db, current_artisan=current_artisan)

@studio_products_router.patch("/{product_id}", response_model=ProductResponse)
def domain_studio_update_product(
    product_id: int,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan)
):
    return update_product(product_id=product_id, product_in=product_in, db=db, current_artisan=current_artisan)

@studio_products_router.post("/{product_id}/submit", response_model=ProductResponse)
def domain_studio_submit_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan)
):
    return transition_product_status(product_id=product_id, status_payload={"status": "PENDING_APPROVAL"}, db=db, current_user=current_artisan)

@studio_products_router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def domain_studio_delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan)
):
    return delete_product(product_id=product_id, db=db, current_artisan=current_artisan)

# ADMIN DOMAIN ENDPOINTS (Governance, Moderation & Publication)
@admin_products_router.get("", response_model=List[ProductResponse])
def domain_admin_list_products(
    status: Optional[str] = Query(None),
    seller_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    return list_products(status=status, seller_id=seller_id, db=db, current_user=current_admin)

@admin_products_router.get("/{product_id}", response_model=ProductResponse)
def domain_admin_get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    return get_product(product_id=product_id, db=db, current_user=current_admin)

@admin_products_router.patch("/{product_id}/approve", response_model=ProductResponse)
def domain_admin_approve_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    return transition_product_status(product_id=product_id, status_payload={"status": "APPROVED"}, db=db, current_user=current_admin)

@admin_products_router.patch("/{product_id}/publish", response_model=ProductResponse)
def domain_admin_publish_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    return transition_product_status(product_id=product_id, status_payload={"status": "PUBLISHED"}, db=db, current_user=current_admin)

@admin_products_router.patch("/{product_id}/suspend", response_model=ProductResponse)
def domain_admin_suspend_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    return transition_product_status(product_id=product_id, status_payload={"status": "SUSPENDED"}, db=db, current_user=current_admin)

@admin_products_router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def domain_admin_delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with id {product_id} not found")
    db.delete(product)
    db.commit()
    return None
