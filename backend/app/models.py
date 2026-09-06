from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, CheckConstraint, Numeric
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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    products = relationship("Product", back_populates="seller")
    events = relationship("Event", back_populates="user")
    orders = relationship("Order", back_populates="user")
    enquiries = relationship("Enquiry", back_populates="user")

class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("price >= 0", name="chk_product_price_non_negative"),
        CheckConstraint("stock >= 0", name="chk_product_stock_non_negative"),
        CheckConstraint("material_cost >= 0", name="chk_product_mat_cost_non_negative"),
        CheckConstraint("labour_cost >= 0", name="chk_product_lab_cost_non_negative"),
        CheckConstraint("packaging_cost >= 0", name="chk_product_pkg_cost_non_negative"),
    )

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    craft_story = Column(Text, nullable=True)
    category = Column(String, index=True, nullable=False)
    materials = Column(String, nullable=True)
    price = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    stock = Column(Integer, nullable=False, default=1)
    image_url = Column(String, nullable=True)
    enhanced_image_url = Column(String, nullable=True)
    # Full 5-stage lifecycle state machine: DRAFT -> AI_PROCESSING -> AI_GENERATED -> APPROVED -> PUBLISHED
    status = Column(String, default="PUBLISHED")
    
    # Cost structure for explainable pricing
    material_cost = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    labour_cost = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    packaging_cost = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    min_margin_pct = Column(Numeric(5, 4), default=Decimal("0.2000"), nullable=False) # 20% minimum protected margin

    seller_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    seller = relationship("User", back_populates="products")

    events = relationship("Event", back_populates="product")
    pricing_decisions = relationship("PricingDecision", back_populates="product")
    orders = relationship("Order", back_populates="product")
    enquiries = relationship("Enquiry", back_populates="product")

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Order(Base):
    """
    Dedicated secure storage for customer orders.
    Customer delivery address and contact details are stored here in a structured,
    secure relation — NEVER leaked into public analytics event metadata.
    """
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
    status = Column(String, default="CONFIRMED") # CONFIRMED, SHIPPED, DELIVERED, CANCELLED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="orders")
    user = relationship("User", back_populates="orders")

class Enquiry(Base):
    """
    Dedicated secure storage for buyer product enquiries.
    Buyer phone number is kept protected here rather than stored in generic event logs.
    """
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

class Event(Base):
    """
    High-frequency market analytics events for demand calculation and trending signals.
    Only contains minimal, sanitized operational metadata. NO PII.
    """
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, index=True, nullable=False) # SEARCH, VIEW, SAVE, ENQUIRY, ORDER
    product_id = Column(Integer, ForeignKey("products.id"), index=True, nullable=True)
    category = Column(String, index=True, nullable=True)
    query = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    metadata_info = Column(Text, nullable=True) # Sanitized metrics only (e.g. {"quantity": 2})
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
