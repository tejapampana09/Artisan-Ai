"""
ONDC Retail v1.2 Catalogue Schemas.
Structures product catalogs, providers, items, and categories according to
the official ONDC Retail specification.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from backend.app.integrations.ondc.schemas.context import ONDCContext

class ONDCDescriptor(BaseModel):
    name: str = Field(..., description="Product or entity name")
    code: Optional[str] = Field(default=None, description="SKU or unique code")
    symbol: Optional[str] = Field(default="", description="Icon or thumbnail URI")
    short_desc: Optional[str] = Field(default="", description="Short description")
    long_desc: Optional[str] = Field(default="", description="Detailed craft description and story")
    images: List[str] = Field(default_factory=list, description="List of image URLs")

class ONDCPrice(BaseModel):
    currency: str = Field(default="INR", description="Three-letter currency code")
    value: str = Field(..., description="Formatted decimal price string, e.g. '1250.00'")
    maximum_value: Optional[str] = Field(default=None, description="Maximum Retail Price (MRP)")

class ONDCQuantityCount(BaseModel):
    count: int = Field(default=1, ge=0)

class ONDCQuantity(BaseModel):
    available: ONDCQuantityCount
    maximum: Optional[ONDCQuantityCount] = None

class ONDCTagListItem(BaseModel):
    code: str
    value: str

class ONDCTagGroup(BaseModel):
    code: str
    list: List[ONDCTagListItem]

class ONDCItem(BaseModel):
    id: str = Field(..., description="Stable item identifier e.g. ARTISAN_PROD_12")
    descriptor: ONDCDescriptor
    category_id: str
    price: ONDCPrice
    quantity: ONDCQuantity
    fulfillment_id: Optional[str] = Field(default="F1_STANDARD_SHIPPING")
    location_id: Optional[str] = Field(default="LOC_1")
    matched: Optional[bool] = Field(default=True)
    tags: List[ONDCTagGroup] = Field(default_factory=list)

class ONDCLocation(BaseModel):
    id: str
    gps: Optional[str] = Field(default="12.9716,77.5946", description="Latitude, Longitude")
    address: Optional[Dict[str, Any]] = None

class ONDCCategory(BaseModel):
    id: str
    descriptor: ONDCDescriptor

class ONDCFulfillment(BaseModel):
    id: str = "F1_STANDARD_SHIPPING"
    type: str = "Delivery"

class ONDCProvider(BaseModel):
    id: str = Field(..., description="Artisan or Collective provider ID e.g. ARTISAN_SELLER_5")
    descriptor: ONDCDescriptor
    categories: List[ONDCCategory] = Field(default_factory=list)
    locations: List[ONDCLocation] = Field(default_factory=list)
    fulfillments: List[ONDCFulfillment] = Field(default_factory=list)
    items: List[ONDCItem] = Field(default_factory=list)
    tags: List[ONDCTagGroup] = Field(default_factory=list)

class ONDCCatalog(BaseModel):
    bpp_descriptor: ONDCDescriptor = Field(..., alias="bpp/descriptor")
    bpp_categories: List[ONDCCategory] = Field(default_factory=list, alias="bpp/categories")
    bpp_fulfillments: List[ONDCFulfillment] = Field(default_factory=list, alias="bpp/fulfillments")
    bpp_providers: List[ONDCProvider] = Field(default_factory=list, alias="bpp/providers")

    model_config = {
        "populate_by_name": True
    }

class ONDCOnSearchMessage(BaseModel):
    catalog: ONDCCatalog

class ONDCOnSearchPayload(BaseModel):
    context: ONDCContext
    message: ONDCOnSearchMessage
