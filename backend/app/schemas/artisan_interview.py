from typing import Optional, List, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, Field
from datetime import datetime

class InterviewStartRequest(BaseModel):
    language: str = Field("te", max_length=10, description="Selected language e.g. te, hi, ta, bn, en")
    photo_url: Optional[str] = Field(None, description="Uploaded photo URL or base64 data URI")
    category_hint: Optional[str] = Field(None, max_length=100, description="Optional craft category hint")

class InterviewAnswerRequest(BaseModel):
    answer: str = Field(..., min_length=1, description="Artisan answer text or transcription")

class ExpectedPriceRequest(BaseModel):
    expected_price: float = Field(..., gt=0, description="Artisan expected selling price in INR")

class FinalPriceRequest(BaseModel):
    material_cost: Optional[float] = Field(None, ge=0)
    labour_cost: Optional[float] = Field(None, ge=0)
    packaging_cost: Optional[float] = Field(None, ge=0)
    other_cost: Optional[float] = Field(None, ge=0)

class PublishListingRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    category: str = Field(..., min_length=2, max_length=100)
    materials: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    craft_story: Optional[str] = None
    title_en: Optional[str] = None
    description_en: Optional[str] = None
    craft_story_en: Optional[str] = None
    translations: Optional[str] = None
    price: Decimal = Field(..., ge=0)
    stock: int = Field(5, ge=0)
    material_cost: Optional[Decimal] = Field(None, ge=0)
    labour_cost: Optional[Decimal] = Field(None, ge=0)
    packaging_cost: Optional[Decimal] = Field(None, ge=0)
    other_cost: Optional[Decimal] = Field(None, ge=0)
    image_url: Optional[str] = None
    enhanced_image_url: Optional[str] = None

class InterviewSessionResponse(BaseModel):
    id: int
    user_id: int
    language: str
    photo_url: Optional[str] = None
    category_hint: Optional[str] = None
    question_count: int
    status: str
    current_question: Optional[str] = None
    product_facts: Dict[str, Any] = Field(default_factory=dict)
    ai_generated_listing: Optional[Dict[str, Any]] = None
    market_research_result: Optional[Dict[str, Any]] = None
    artisan_expected_price: Optional[float] = None
    recommended_price: Optional[float] = None
    pricing_explanation: List[str] = Field(default_factory=list)
    created_at: datetime
