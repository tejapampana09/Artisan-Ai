from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
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
    phone: str
    active_mode: str
    location: str
    craft: str

class ModeUpdateRequest(BaseModel):
    mode: str = Field(..., pattern="^(SELL|BUY)$")

# Product Schemas
class ProductBase(BaseModel):
    title: str
    description: Optional[str] = None
    craft_story: Optional[str] = None
    category: str
    materials: Optional[str] = None
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
    title: Optional[str] = None
    description: Optional[str] = None
    craft_story: Optional[str] = None
    category: Optional[str] = None
    materials: Optional[str] = None
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
    query: Optional[str] = None
    metadata_info: Optional[str] = None

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
    buyer_name: str
    buyer_phone: str
    quantity: int = Field(default=1, ge=1)
    message: Optional[str] = None

class OrderCreate(BaseModel):
    product_id: int
    buyer_name: str
    quantity: int = Field(default=1, ge=1)
    delivery_address: str
