from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="Lakshmi Devi")
    phone = Column(String, default="+91 98765 43210")
    active_mode = Column(String, default="SELL")  # "SELL" or "BUY"
    location = Column(String, default="Machilipatnam, Andhra Pradesh")
    craft = Column(String, default="Hand-block Kalamkari")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    products = relationship("Product", back_populates="seller")
    events = relationship("Event", back_populates="user")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    craft_story = Column(Text, nullable=True)
    category = Column(String, index=True, nullable=False)
    materials = Column(String, nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    stock = Column(Integer, nullable=False, default=1)
    image_url = Column(String, nullable=True)
    enhanced_image_url = Column(String, nullable=True)
    status = Column(String, default="PUBLISHED")  # DRAFT, APPROVED, PUBLISHED
    
    # Cost structure for explainable pricing
    material_cost = Column(Float, default=0.0)
    labour_cost = Column(Float, default=0.0)
    packaging_cost = Column(Float, default=0.0)
    min_margin_pct = Column(Float, default=0.20)  # 20% minimum protected margin

    seller_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    seller = relationship("User", back_populates="products")

    events = relationship("Event", back_populates="product")
    pricing_decisions = relationship("PricingDecision", back_populates="product")

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, index=True, nullable=False)  # SEARCH, VIEW, SAVE, ENQUIRY, ORDER
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    category = Column(String, index=True, nullable=True)
    query = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    metadata_info = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="events")
    user = relationship("User", back_populates="events")

class PricingDecision(Base):
    __tablename__ = "pricing_decisions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    decision = Column(String, nullable=False)  # ACCEPT or REJECT
    previous_price = Column(Float, nullable=False)
    recommended_price = Column(Float, nullable=False)
    applied_price = Column(Float, nullable=False)
    demand_factor = Column(Float, nullable=False)
    market_adjustment = Column(Float, nullable=False)
    reasoning_json = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="pricing_decisions")
