from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    timestamp: datetime

class ReadyResponse(BaseModel):
    status: str
    database: str
    user_count: int

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = "ARTISAN"
    active_mode: str
    location: Optional[str] = None
    craft: Optional[str] = None

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2)
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str = Field(..., min_length=6)
    role: Optional[str] = "ARTISAN"
    location: Optional[str] = "India"
    craft: Optional[str] = "Traditional Crafts"
    active_mode: Optional[str] = None

class UserLogin(BaseModel):
    email_or_phone: str
    password: str

class ResetPasswordRequest(BaseModel):
    email_or_phone: str = Field(..., min_length=3)
    new_password: str = Field(..., min_length=6)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ModeUpdateRequest(BaseModel):
    mode: str = Field(..., pattern="^(SELL|BUY)$")

# Product Schemas
class ProductBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=3000)
    craft_story: Optional[str] = Field(None, max_length=3000)
    category: str = Field(..., min_length=2, max_length=100)
    materials: Optional[str] = Field(None, max_length=500)
    price: float = Field(ge=0.0)
    stock: int = Field(default=1, ge=0)
    image_url: Optional[str] = None
    enhanced_image_url: Optional[str] = None
    status: str = "PUBLISHED"  # DRAFT, APPROVED, PUBLISHED
    material_cost: float = Field(default=0.0, ge=0.0)
    labour_cost: float = Field(default=0.0, ge=0.0)
    packaging_cost: float = Field(default=0.0, ge=0.0)
    min_margin_pct: float = Field(default=0.20, ge=0.0, le=1.0)
    seller_id: Optional[int] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=3000)
    craft_story: Optional[str] = Field(None, max_length=3000)
    category: Optional[str] = Field(None, min_length=2, max_length=100)
    materials: Optional[str] = Field(None, max_length=500)
    price: Optional[float] = Field(default=None, ge=0.0)
    stock: Optional[int] = Field(default=None, ge=0)
    image_url: Optional[str] = None
    enhanced_image_url: Optional[str] = None
    status: Optional[str] = None
    material_cost: Optional[float] = Field(default=None, ge=0.0)
    labour_cost: Optional[float] = Field(default=None, ge=0.0)
    packaging_cost: Optional[float] = Field(default=None, ge=0.0)
    min_margin_pct: Optional[float] = Field(default=None, ge=0.0, le=1.0)

class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

# Step 4: Event & Marketplace Schemas
class EventCreate(BaseModel):
    event_type: str = Field(..., pattern="^(SEARCH|VIEW|SAVE|ENQUIRY|ORDER)$")
    product_id: Optional[int] = None
    category: Optional[str] = None
    query: Optional[str] = Field(None, max_length=200)
    metadata_info: Optional[str] = Field(None, max_length=1000)

class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    product_id: Optional[int] = None
    category: Optional[str] = None
    query: Optional[str] = None
    metadata_info: Optional[str] = None
    timestamp: datetime

class EnquiryCreate(BaseModel):
    product_id: int
    buyer_name: Optional[str] = Field(default="", max_length=100)
    buyer_phone: Optional[str] = Field(default="", max_length=25)
    quantity: int = Field(default=1, ge=1)
    message: Optional[str] = Field(None, max_length=1000)

class EnquiryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_title: Optional[str] = None
    product_image: Optional[str] = None
    user_id: Optional[int] = None
    buyer_name: str
    buyer_phone: Optional[str] = None
    quantity: int
    message: Optional[str] = None
    created_at: datetime

class OrderCreate(BaseModel):
    product_id: int
    buyer_name: Optional[str] = Field(default="", max_length=100)
    buyer_phone: Optional[str] = Field(default=None, max_length=25)
    quantity: int = Field(default=1, ge=1)
    delivery_address: str = Field(..., min_length=3, max_length=500)

class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_title: Optional[str] = None
    product_image: Optional[str] = None
    user_id: Optional[int] = None
    buyer_name: str
    buyer_phone: Optional[str] = None
    quantity: int
    unit_price: float
    total_price: float
    delivery_address: str
    status: str
    created_at: datetime

# Step 6: Explainable Dynamic Pricing Schemas
class PriceRecommendationResponse(BaseModel):
    product_id: int
    product_title: str
    category: str
    current_price: float
    cost_basis: float
    minimum_fair_price: float
    demand_factor: float
    market_adjustment: float
    recommended_price: float
    market_range: Dict[str, float]
    current_market_position: str
    price_change_amount: float
    price_change_percentage: float
    reasoning: List[str]
    safety_constraints: Dict[str, Any]

class PriceDecisionRequest(BaseModel):
    decision: str = Field(..., pattern="^(ACCEPT|REJECT)$")

class PriceDecisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    decision: str
    previous_price: float
    recommended_price: float
    applied_price: float
    demand_factor: float
    market_adjustment: float
    timestamp: datetime
