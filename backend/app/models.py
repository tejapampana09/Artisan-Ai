from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, CheckConstraint, Numeric, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from backend.app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    role = Column(String, default="ARTISAN", nullable=False) # "ARTISAN", "BUYER", "ADMIN"
    active_mode = Column(String, default="SELL", nullable=False) # "SELL" or "BUY"
    location = Column(String, nullable=True)
    craft = Column(String, nullable=True)
    token_version = Column(Integer, default=1, nullable=False)
    
    # Profile & Verification extensions
    avatar_url = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    craft_specialization = Column(String, nullable=True)
    experience_years = Column(Integer, default=0, nullable=False)
    verification_status = Column(String, default="UNVERIFIED", nullable=False) # "UNVERIFIED", "PROFILE_COMPLETE", "VERIFIED_ARTISAN"

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    products = relationship("Product", back_populates="seller")
    events = relationship("Event", back_populates="user")
    orders = relationship("Order", back_populates="user")
    enquiries = relationship("Enquiry", back_populates="user")
    reviews = relationship("Review", back_populates="buyer")
    notifications = relationship("Notification", back_populates="user")
    interview_sessions = relationship("InterviewSession", back_populates="user")

class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("price >= 0", name="chk_product_price_non_negative"),
        CheckConstraint("stock >= 0", name="chk_product_stock_non_negative"),
        CheckConstraint("material_cost >= 0", name="chk_product_mat_cost_non_negative"),
        CheckConstraint("labour_cost >= 0", name="chk_product_lab_cost_non_negative"),
        CheckConstraint("packaging_cost >= 0", name="chk_product_pkg_cost_non_negative"),
        CheckConstraint("other_cost >= 0", name="chk_product_oth_cost_non_negative"),
    )

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    craft_story = Column(Text, nullable=True)
    
    # Multilingual & Internationalization fields
    title_en = Column(String, nullable=True)
    description_en = Column(Text, nullable=True)
    craft_story_en = Column(Text, nullable=True)
    translations = Column(Text, nullable=True) # JSON string of multi-language translations {"en": {}, "te": {}, "hi": {}, "ta": {}, "bn": {}}

    category = Column(String, index=True, nullable=False)
    materials = Column(String, nullable=True)
    price = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    stock = Column(Integer, nullable=False, default=1)
    image_url = Column(String, nullable=True)
    enhanced_image_url = Column(String, nullable=True)
    secondary_images = Column(Text, nullable=True) # JSON array string of additional product images
    
    # Craft Passport & Provenance fields
    craft_process = Column(Text, nullable=True)
    region_of_origin = Column(String, nullable=True)
    handmade_pct = Column(Integer, default=100, nullable=False)
    production_time_days = Column(Integer, nullable=True)
    verification_status = Column(String, default="ARTISAN_PROVIDED", nullable=False) # "ARTISAN_PROVIDED", "AI_DRAFT", "PENDING_VERIFICATION", "VERIFIED"

    # Lifecycle status: DRAFT -> AI_PROCESSING -> AI_GENERATED -> APPROVED -> PUBLISHED
    status = Column(String, default="PUBLISHED")
    
    # Cost structure for explainable pricing
    material_cost = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    labour_cost = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    packaging_cost = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    other_cost = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    min_margin_pct = Column(Numeric(5, 4), default=Decimal("0.2000"), nullable=False) # 20% minimum protected margin
    auto_smart_pricing_enabled = Column(Boolean, default=False, nullable=False)


    seller_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    seller = relationship("User", back_populates="products")

    events = relationship("Event", back_populates="product")
    pricing_decisions = relationship("PricingDecision", back_populates="product")
    orders = relationship("Order", back_populates="product")
    enquiries = relationship("Enquiry", back_populates="product")
    reviews = relationship("Review", back_populates="product")

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_order_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="chk_order_unit_price_non_negative"),
        CheckConstraint("total_price >= 0", name="chk_order_total_price_non_negative"),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    buyer_name = Column(String, nullable=False)
    buyer_phone = Column(String, nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(12, 2), nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)
    delivery_address = Column(Text, nullable=False)
    status = Column(String, default="CONFIRMED") # CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED
    
    # Cancellation & Refund workflow
    cancellation_status = Column(String, default="NONE", nullable=False) # "NONE", "REQUESTED", "CANCELLED", "REJECTED"
    cancellation_reason = Column(Text, nullable=True)
    tracking_history = Column(Text, nullable=True) # JSON timeline array string

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="orders")
    user = relationship("User", back_populates="orders")
    review = relationship("Review", back_populates="order", uselist=False)

class Enquiry(Base):
    __tablename__ = "enquiries"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    buyer_name = Column(String, nullable=False)
    buyer_phone = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    message = Column(Text, nullable=True)
    artisan_reply = Column(Text, nullable=True)
    replied_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="enquiries")
    user = relationship("User", back_populates="enquiries")

class Review(Base):
    """
    Verified Buyer Reviews & Ratings.
    Directly linked to a completed order to enforce verified purchase trust badge.
    """
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="chk_review_rating_range"),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), index=True, nullable=True)
    buyer_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    buyer_name = Column(String, nullable=False)
    rating = Column(Integer, nullable=False) # 1 to 5 stars
    comment = Column(Text, nullable=True)
    verified_purchase = Column(Integer, default=1, nullable=False) # 1 for True
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="reviews")
    order = relationship("Order", back_populates="review")
    buyer = relationship("User", back_populates="reviews")

class Notification(Base):
    """
    Persistent System Notifications for Artisans & Buyers.
    Stores alerts for Orders, Status Updates, Stock Warnings, Reviews, and Sync Events.
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, default="GENERAL", nullable=False) # ORDER, REVIEW, STOCK, SYNC
    is_read = Column(Integer, default=0, nullable=False) # 0 for False, 1 for True
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="notifications")

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, index=True, nullable=False) # SEARCH, VIEW, SAVE, ENQUIRY, ORDER
    product_id = Column(Integer, ForeignKey("products.id"), index=True, nullable=True)
    category = Column(String, index=True, nullable=True)
    query = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    metadata_info = Column(Text, nullable=True) # Sanitized metrics only
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="events")
    user = relationship("User", back_populates="events")

class PricingDecision(Base):
    __tablename__ = "pricing_decisions"
    __table_args__ = (
        CheckConstraint("previous_price >= 0", name="chk_pd_prev_price_non_negative"),
        CheckConstraint("recommended_price >= 0", name="chk_pd_rec_price_non_negative"),
        CheckConstraint("applied_price >= 0", name="chk_pd_app_price_non_negative"),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True, nullable=False)
    decision = Column(String, nullable=False) # ACCEPT or REJECT
    previous_price = Column(Numeric(12, 2), nullable=False)
    recommended_price = Column(Numeric(12, 2), nullable=False)
    applied_price = Column(Numeric(12, 2), nullable=False)
    demand_factor = Column(Numeric(6, 4), nullable=False)
    market_adjustment = Column(Numeric(6, 4), nullable=False)
    reasoning_json = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="pricing_decisions")

class ProcessedOperation(Base):
    __tablename__ = "processed_operations"
    __table_args__ = (
        UniqueConstraint("user_id", "entity_type", "client_operation_id", name="uq_processed_op_user_entity_client_op_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    client_operation_id = Column(String, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    entity_type = Column(String, nullable=False) # "PRODUCT" or "PRICE_DECISION"
    result_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class InterviewSession(Base):
    """
    V2 Multilingual Adaptive Interview Session.
    Tracks state of artisan product understanding conversation.
    """
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    language = Column(String, default="te", nullable=False) # te, hi, ta, bn, en
    photo_url = Column(Text, nullable=True)
    category_hint = Column(String, nullable=True)
    question_count = Column(Integer, default=0, nullable=False) # max 5
    status = Column(String, default="ACTIVE", nullable=False) # ACTIVE, FACTS_COMPLETE, MARKET_RESEARCH_COMPLETE, PRICE_PENDING, READY_FOR_REVIEW, PUBLISHED, ABANDONED
    product_facts = Column(Text, nullable=True) # JSON object string of extracted facts with provenance
    ai_generated_listing = Column(Text, nullable=True) # JSON object string of generated title, desc, story, tags, translations
    market_research_result = Column(Text, nullable=True) # JSON object string of comparable market research summary
    artisan_expected_price = Column(Numeric(12, 2), nullable=True)
    recommended_price = Column(Numeric(12, 2), nullable=True)
    pricing_explanation = Column(Text, nullable=True) # JSON list of bullet points
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="interview_sessions")
    turns = relationship("InterviewTurn", back_populates="session", cascade="all, delete-orphan")
    market_evidences = relationship("MarketEvidence", back_populates="session", cascade="all, delete-orphan")

class InterviewTurn(Base):
    """
    Individual question/answer turn in an adaptive interview session.
    """
    __tablename__ = "interview_turns"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), index=True, nullable=False)
    turn_number = Column(Integer, nullable=False)
    speaker = Column(String, nullable=False) # ASSISTANT or ARTISAN
    question = Column(Text, nullable=True)
    answer = Column(Text, nullable=True)
    extracted_facts = Column(Text, nullable=True) # JSON array string of facts extracted in this turn
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("InterviewSession", back_populates="turns")

class MarketEvidence(Base):
    """
    Evidence-based market research data points retrieved for comparable crafts.
    """
    __tablename__ = "market_evidences"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), index=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), index=True, nullable=True)
    source = Column(String, default="OBSERVED_MARKET_DATA", nullable=False) # OBSERVED_MARKET_DATA, MODEL_ESTIMATE, BACKEND_CALCULATION
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    material = Column(String, nullable=True)
    listed_price = Column(Numeric(12, 2), nullable=False)
    similarity_score = Column(Numeric(4, 3), default=Decimal("1.000"), nullable=False)
    source_url = Column(Text, nullable=True)
    retrieved_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("InterviewSession", back_populates="market_evidences")
    product = relationship("Product")



