from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    timestamp: datetime

class ArtisanFacts(BaseModel):
    product_name: Optional[str] = Field(
        default="",
        description="Product name explicitly provided by artisan"
    )
    craft_type: Optional[str] = Field(
        default="",
        description="Craft type/category explicitly provided by artisan"
    )
    materials: List[str] = Field(
        default_factory=list,
        description="Materials explicitly stated by artisan"
    )
    handmade: Optional[bool] = Field(
        default=None,
        description="Whether artisan explicitly stated the product is handmade"
    )
    making_time: Optional[str] = Field(
        default="",
        description="Time required to make the product, only if stated by artisan"
    )
    artisan_story: Optional[str] = Field(
        default="",
        description="Story/heritage information explicitly stated by artisan"
    )
    special_characteristics: Optional[str] = Field(
        default="",
        description="Special characteristics explicitly stated by artisan"
    )

class ReadyResponse(BaseModel):
    status: str
    database: str
    user_count: Optional[int] = None

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = "BUYER"
    status: Optional[str] = "ACTIVE"
    location: Optional[str] = None
    craft: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    craft_specialization: Optional[str] = None
    experience_years: Optional[int] = 0
    verification_status: Optional[str] = "UNVERIFIED"

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=20)
    location: Optional[str] = Field(None, max_length=200)
    craft: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=2048)
    bio: Optional[str] = Field(None, max_length=1000)
    craft_specialization: Optional[str] = Field(None, max_length=100)
    experience_years: Optional[int] = None

    @field_validator("avatar_url")
    @classmethod
    def validate_avatar_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not (v.startswith("https://") or v.startswith("data:image/")):
            raise ValueError("avatar_url must be a valid HTTPS URL or an inline data:image URI")
        return v


class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str = Field(..., min_length=8, max_length=128)
    role: Optional[str] = "BUYER"
    location: Optional[str] = "India"
    craft: Optional[str] = "Traditional Crafts"

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        import re
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter (A-Z)")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit (0-9)")
        return v

class ArtisanRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str = Field(..., min_length=8, max_length=128)
    craft: Optional[str] = "Traditional Handicrafts"
    location: Optional[str] = "India"
    bio: Optional[str] = Field(None, max_length=1000)
    experience_years: Optional[int] = 0

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        import re
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter (A-Z)")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit (0-9)")
        return v

class ArtisanApplicationResponse(BaseModel):
    application_id: Optional[int] = None
    status: str = "PENDING"
    verification_status: str = "PENDING_VERIFICATION"
    message: str
    user: UserResponse

class AdminCreateSellerRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str = Field(..., min_length=8, max_length=128)
    craft: Optional[str] = "Traditional Handicrafts"
    location: Optional[str] = "India"
    bio: Optional[str] = Field(None, max_length=1000)
    verification_status: Optional[str] = "GI_VERIFIED"
    experience_years: Optional[int] = 0

class UserLogin(BaseModel):
    email_or_phone: str
    password: str

class ResetPasswordRequest(BaseModel):
    email_or_phone: str = Field(..., min_length=3)
    new_password: str = Field(..., min_length=8, max_length=128)

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, v: str) -> str:
        import re
        if not re.search(r"[A-Z]", v):
            raise ValueError("New password must contain at least one uppercase letter (A-Z)")
        if not re.search(r"[0-9]", v):
            raise ValueError("New password must contain at least one digit (0-9)")
        return v

class AdminResetArtisanPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128, description="New password for artisan seller account")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    auth_domain: Optional[str] = None
    session_type: Optional[str] = None
    user: UserResponse

# Product Schemas
class ProductBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=3000)
    craft_story: Optional[str] = Field(None, max_length=3000)
    title_en: Optional[str] = Field(None, max_length=200)
    description_en: Optional[str] = Field(None, max_length=3000)
    craft_story_en: Optional[str] = Field(None, max_length=3000)
    translations: Optional[str] = None
    category: str = Field(..., min_length=2, max_length=100)
    materials: Optional[str] = Field(None, max_length=500)
    price: float = Field(ge=0.0)
    stock: int = Field(default=1, ge=0)
    image_url: Optional[str] = None
    enhanced_image_url: Optional[str] = None
    status: str = "DRAFT"  # DRAFT, AI_PROCESSING, PENDING_REVIEW, PUBLISHED, SUSPENDED, ARCHIVED
    material_cost: float = Field(default=0.0, ge=0.0)
    labour_cost: float = Field(default=0.0, ge=0.0)
    packaging_cost: float = Field(default=0.0, ge=0.0)
    other_cost: float = Field(default=0.0, ge=0.0)
    min_margin_pct: float = Field(default=0.20, ge=0.0, le=1.0)
    auto_smart_pricing_enabled: bool = False
    seller_id: Optional[int] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=3000)
    craft_story: Optional[str] = Field(None, max_length=3000)
    title_en: Optional[str] = Field(None, max_length=200)
    description_en: Optional[str] = Field(None, max_length=3000)
    craft_story_en: Optional[str] = Field(None, max_length=3000)
    translations: Optional[str] = None
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
    other_cost: Optional[float] = Field(default=None, ge=0.0)
    min_margin_pct: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    auto_smart_pricing_enabled: Optional[bool] = None


class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None

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

class GoogleAuthRequest(BaseModel):
    token: Optional[str] = Field(default=None, description="Google OAuth ID Token or Credential string")
    access_token: Optional[str] = Field(default=None, description="Google OAuth 2.0 Access Token from Google popup")
    email: Optional[str] = Field(default=None, description="User email from Google OAuth profile")
    name: Optional[str] = Field(default=None, description="User full name from Google OAuth profile")
    google_id: Optional[str] = Field(default=None, description="Google OAuth unique User ID")
    role: Optional[str] = Field(default="BUYER", description="Target user role: BUYER")

class OrderCreate(BaseModel):
    product_id: int
    buyer_name: Optional[str] = Field(default="", max_length=100)
    buyer_phone: Optional[str] = Field(default=None, max_length=25)
    quantity: int = Field(default=1, ge=1)
    delivery_address: str = Field(..., min_length=3, max_length=500)
    payment_method: Optional[str] = Field(default="UPI", max_length=50)

class OrderStatusUpdate(BaseModel):
    status: str = Field(..., description="Order status: PENDING_PAYMENT, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED")

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
    total_amount: Optional[float] = None
    delivery_address: str
    payment_method: Optional[str] = "UPI"
    payment_status: str = "UNPAID"
    payment_tx_id: Optional[str] = None
    status: str
    created_at: datetime

class PaymentCreateRequest(BaseModel):
    order_id: int
    provider: str = Field(default="RAZORPAY", description="Payment provider: RAZORPAY, UPI_QR, COD")
    idempotency_key: Optional[str] = None

class PaymentVerifyRequest(BaseModel):
    order_id: int
    provider: str
    provider_order_id: Optional[str] = None
    provider_payment_id: Optional[str] = None
    signature: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    idempotency_key: Optional[str] = None

class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    provider: str
    provider_order_id: Optional[str] = None
    provider_payment_id: Optional[str] = None
    amount: float
    currency: str
    status: str
    signature_verified: bool
    created_at: datetime
    verified_at: Optional[datetime] = None

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
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    craft_cluster: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, max_length=100)
    pincode: Optional[str] = Field(None, max_length=20)

class ArtisanLocationUpdate(BaseModel):
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    craft_cluster: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, max_length=100)
    pincode: Optional[str] = Field(None, max_length=20)

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
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    craft_cluster: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None

class CraftClusterInfo(BaseModel):
    id: str
    name: str
    craft: str
    category: str
    state: str
    district: str
    latitude: float
    longitude: float
    description: str
    heritage_age: str
    artisan_count: int = 0
    products_count: int = 0

class ArtisanMapPin(BaseModel):
    artisan_id: int
    artisan_name: str
    avatar_url: Optional[str] = None
    craft: str
    craft_cluster: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    latitude: float
    longitude: float
    verification_status: str
    products_count: int = 0
    average_rating: float = 0.0
    sample_products: List[dict] = []


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

# Market Research Schemas (Phase 5 Hardened)
class MarketProvenance:
    EXTERNAL_LIVE = "EXTERNAL_LIVE"
    INTERNAL_MARKETPLACE = "INTERNAL_MARKETPLACE"
    AI_ESTIMATE = "AI_ESTIMATE"
    NONE = "NONE"

class MarketSearchProfile(BaseModel):
    object_type: str = ""
    craft: str = ""
    category: str = ""
    material: List[str] = Field(default_factory=list)
    technique: List[str] = Field(default_factory=list)
    region: List[str] = Field(default_factory=list)
    style: List[str] = Field(default_factory=list)
    color: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)

class MarketListing(BaseModel):
    title: str
    price: Optional[float] = None
    currency: str = "INR"
    source: str = ""
    url: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    materials: List[str] = Field(default_factory=list)

    matched_product: bool = False
    matched_material: bool = False
    matched_craft: bool = False
    matched_technique: bool = False
    similarity_score: float = 0.0
    match_tier: str = "WEAK"  # STRONG (>=0.80), GOOD (>=0.50), WEAK (>=0.20)
    match_reasons: List[str] = Field(default_factory=list)
    market_source_type: str = "EXTERNAL_LIVE"
    page_verified: bool = False
    product_verified: bool = False
    price_verified: bool = False
    extraction_method: Optional[str] = None
    observed_at: Optional[datetime] = None

class MarketSummary(BaseModel):
    comparable_count: int = 0
    priced_comparable_count: int = 0
    candidate_count: int = 0
    verified_count: int = 0
    priced_count: int = 0
    min_price: Optional[float] = None
    median_price: Optional[float] = None
    max_price: Optional[float] = None
    currency: str = "INR"
    market_confidence: str = "LOW"
    is_reliable: bool = False
    market_source_type: Optional[str] = None
    internal_comparable_count: int = 0
    ai_estimated_price: Optional[float] = None

class MarketResearchRequest(BaseModel):
    artisan_facts: ArtisanFacts

class MarketResearchResponse(BaseModel):
    query: str
    results: List[MarketListing] = Field(default_factory=list)
    summary: MarketSummary
    notice: Optional[str] = None

class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_id: Optional[int] = None
    actor_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    before_state: Optional[str] = None
    after_state: Optional[str] = None
    reason: Optional[str] = None
    ip_metadata: Optional[str] = None
    created_at: datetime


# ─── Delivery Address Schemas ───────────────────────────────────────────────

class AddressCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    pincode: str = Field(..., min_length=6, max_length=10)
    address_line: str = Field(..., min_length=5, max_length=300)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    tag: Optional[str] = Field(default="HOME")  # HOME, WORK, OTHER
    is_default: Optional[bool] = False

class AddressUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    pincode: Optional[str] = Field(default=None, max_length=10)
    address_line: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = None
    state: Optional[str] = None
    tag: Optional[str] = None
    is_default: Optional[bool] = None

class AddressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    phone: Optional[str] = None
    pincode: str
    address_line: str
    city: Optional[str] = None
    state: Optional[str] = None
    tag: str = "HOME"
    is_default: bool = False
    created_at: datetime


# ─── Payout Account Schemas ─────────────────────────────────────────────────

class PayoutAccountUpdate(BaseModel):
    upi_id: Optional[str] = Field(default=None, max_length=100)
    account_holder_name: Optional[str] = Field(default=None, max_length=150)
    account_number: Optional[str] = Field(default=None, max_length=30)
    ifsc_code: Optional[str] = Field(default=None, max_length=20)
    bank_name: Optional[str] = Field(default=None, max_length=100)

class PayoutAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    artisan_id: int
    upi_id: Optional[str] = None
    account_holder_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None
    is_verified: bool = False
    updated_at: Optional[datetime] = None

