"""
ONDC Search Request Schema.
Defines the schema for incoming /search discovery requests from buyer apps and the ONDC gateway.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from backend.app.integrations.ondc.schemas.context import ONDCContext

class ONDCSearchIntentDescriptor(BaseModel):
    name: Optional[str] = Field(default=None, description="Search query string or product title keyword")
    code: Optional[str] = Field(default=None)

class ONDCSearchIntentItem(BaseModel):
    descriptor: Optional[ONDCSearchIntentDescriptor] = None

class ONDCSearchIntentCategory(BaseModel):
    id: Optional[str] = Field(default=None, description="Category identifier or name")
    descriptor: Optional[ONDCSearchIntentDescriptor] = None

class ONDCSearchIntentProvider(BaseModel):
    id: Optional[str] = Field(default=None, description="Artisan or provider identifier")
    descriptor: Optional[ONDCSearchIntentDescriptor] = None

class ONDCSearchIntentFulfillment(BaseModel):
    type: Optional[str] = None
    end: Optional[Dict[str, Any]] = None

class ONDCSearchIntent(BaseModel):
    item: Optional[ONDCSearchIntentItem] = None
    category: Optional[ONDCSearchIntentCategory] = None
    provider: Optional[ONDCSearchIntentProvider] = None
    fulfillment: Optional[ONDCSearchIntentFulfillment] = None
    tags: Optional[List[Dict[str, Any]]] = None

    # Support simplified or flat queries from prototype/testing clients
    query: Optional[str] = Field(default=None, description="Convenience query string for test clients")

class ONDCSearchMessage(BaseModel):
    intent: Optional[ONDCSearchIntent] = None

class ONDCSearchRequest(BaseModel):
    context: ONDCContext
    message: Optional[ONDCSearchMessage] = None
