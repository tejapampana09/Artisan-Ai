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

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
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

class EnquiryReply(BaseModel):
    artisan_reply: str = Field(..., min_length=1, max_length=1000)

class EnquiryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_title: Optional[str] = None
    product_image: Optional[str] = None
    seller_id: Optional[int] = None
    seller_name: Optional[str] = None
    user_id: Optional[int] = None
    buyer_name: str
    buyer_phone: Optional[str] = None
    quantity: int
    message: Optional[str] = None
    artisan_reply: Optional[str] = None
    replied_at: Optional[datetime] = None
    created_at: datetime

class OrderCreate(BaseModel):
    product_id: int
    buyer_name: Optional[str] = Field(default="", max_length=100)
    buyer_phone: Optional[str] = Field(default=None, max_length=25)
    quantity: int = Field(default=1, ge=1)
    delivery_address: str = Field(..., min_length=3, max_length=500)

class OrderStatusUpdate(BaseModel):
    status: str = Field(..., description="Order status: CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED")

class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_title: Optional[str] = None
    product_image: Optional[str] = None
    seller_id: Optional[int] = None
    seller_name: Optional[str] = None
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

class ProductPerformance(BaseModel):
    product_id: int
    title: str
    category: str
    price: float
    stock: int
    status: str
    image_url: Optional[str] = None
    views: int = 0
    units_sold: int = 0
    revenue: float = 0.0
    orders_count: int = 0

class DeliveryStatusBreakdown(BaseModel):
    confirmed: int = 0
    processing: int = 0
    shipped: int = 0
    delivered: int = 0
    cancelled: int = 0

class SellerDashboardResponse(BaseModel):
    total_revenue: float
    units_sold: int
    total_orders: int
    total_views: int
    total_enquiries: int
    delivery_status: DeliveryStatusBreakdown
    product_performance: List[ProductPerformance]

# Review & Rating Schemas
class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)
    order_id: Optional[int] = None

class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    order_id: Optional[int] = None
    buyer_id: Optional[int] = None
    buyer_name: str
    rating: int
    comment: Optional[str] = None
    verified_purchase: bool = True
    created_at: datetime

# Notification Schema
class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    message: str
    type: str
    is_read: bool = False
    created_at: datetime

# Order Cancellation Request
class OrderCancelRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)

# Artisan Profile Update
class ArtisanProfileUpdate(BaseModel):
    avatar_url: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=2000)
    craft_specialization: Optional[str] = Field(None, max_length=200)
    experience_years: Optional[int] = Field(default=0, ge=0)
    location: Optional[str] = Field(None, max_length=200)

class ArtisanProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    craft: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    craft_specialization: Optional[str] = None
    experience_years: int = 0
    verification_status: str = "UNVERIFIED"
    total_products_count: int = 0
    average_rating: float = 0.0

# Buyer AI Copilot Schemas
class BuyerCopilotRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    language: Optional[str] = "te"
    max_budget: Optional[float] = None
    category: Optional[str] = None

class BuyerCopilotResponse(BaseModel):
    reply_text: str
    language: str
    recommended_products: List[ProductResponse] = []
    search_query_used: Optional[str] = None
    match_count: int = 0
    is_fallback: bool = False



