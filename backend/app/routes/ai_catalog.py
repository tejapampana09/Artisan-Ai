from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Product, User
from backend.app.schemas import ProductResponse
from backend.app.services.ai_adapter import generate_catalog_draft
from backend.app.services.auth import get_current_user

router = APIRouter(prefix="/api/ai", tags=["AI Cataloging"])

class AICatalogRequest(BaseModel):
    voice_description: str = Field(..., min_length=2)
    language: str = "en"  # "en", "te", "hi", "ta", "bn"
    image_url: Optional[str] = None
    category_hint: Optional[str] = None
    material_cost: Optional[float] = None
    labour_cost: Optional[float] = None
    packaging_cost: Optional[float] = None

class AICatalogDraftResponse(BaseModel):
    source: str  # "LIVE AI" or "DEMO FALLBACK"
    title: str
    category: str
    materials: str
    description: str
    craft_story: str
    tags: List[str]
    suggested_price: float
    min_fair_price: float
    material_cost: float
    labour_cost: float
    packaging_cost: float
    min_margin_pct: float
    image_url: str
    enhanced_image_url: str
    transcription: str
    language_detected: str
    lifecycle_state: str = "AI_GENERATED"

class CatalogApproveRequest(BaseModel):
    title: str
    category: str
    materials: Optional[str] = None
    description: Optional[str] = None
    craft_story: Optional[str] = None
    price: float
    stock: int = 5
    material_cost: float
    labour_cost: float
    packaging_cost: float
    min_margin_pct: float = 0.20
    image_url: Optional[str] = None
    enhanced_image_url: Optional[str] = None
    status: str = "PUBLISHED"

@router.post("/process-catalog", response_model=AICatalogDraftResponse)
async def process_voice_and_image(req: AICatalogRequest):
    draft = await generate_catalog_draft(
        voice_description=req.voice_description,
        language=req.language,
        image_url=req.image_url,
        category_hint=req.category_hint,
        material_cost=req.material_cost,
        labour_cost=req.labour_cost,
        packaging_cost=req.packaging_cost
    )
    return AICatalogDraftResponse(**draft)

@router.post("/approve-and-publish", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def approve_and_publish_product(
    req: CatalogApproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = Product(
        title=req.title,
        category=req.category,
        materials=req.materials,
        description=req.description,
        craft_story=req.craft_story,
        price=Decimal(str(req.price)),
        stock=req.stock,
        material_cost=Decimal(str(req.material_cost)) if req.material_cost is not None else Decimal("0.00"),
        labour_cost=Decimal(str(req.labour_cost)) if req.labour_cost is not None else Decimal("0.00"),
        packaging_cost=Decimal(str(req.packaging_cost)) if req.packaging_cost is not None else Decimal("0.00"),
        min_margin_pct=Decimal(str(req.min_margin_pct)) if req.min_margin_pct is not None else Decimal("0.20"),
        image_url=req.image_url,
        enhanced_image_url=req.enhanced_image_url,
        status=req.status,
        seller_id=current_user.id
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product
