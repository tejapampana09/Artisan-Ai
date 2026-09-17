"""
ONDC Beckn Protocol Context Schema.
Validates the canonical envelope metadata present in every ONDC request/response.
"""

from typing import Optional
from pydantic import BaseModel, Field

class ONDCContext(BaseModel):
    domain: str = Field(..., description="ONDC domain code, e.g. ONDC:RET12 (Fashion/Handloom) or ONDC:RET15 (Home & Decor/Handicrafts)")
    country: str = Field(default="IND", description="Country code (ISO 3166-1 alpha-3)")
    city: str = Field(default="std:080", description="City code (STD code format)")
    action: str = Field(..., description="Beckn action: search, on_search, select, on_select, etc.")
    core_version: str = Field(default="1.2.0", description="Beckn core protocol version")
    bap_id: Optional[str] = Field(default=None, description="Buyer App Participant ID")
    bap_uri: Optional[str] = Field(default=None, description="Buyer App callback URI")
    bpp_id: Optional[str] = Field(default=None, description="Seller App Participant ID")
    bpp_uri: Optional[str] = Field(default=None, description="Seller App base URI")
    transaction_id: str = Field(..., description="Unique end-to-end transaction identifier")
    message_id: str = Field(..., description="Unique message invocation identifier")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp of message dispatch")
    ttl: Optional[str] = Field(default="PT30S", description="Time-to-live duration, e.g. PT30S")
    key: Optional[str] = Field(default=None, description="Public encryption key if applicable")
