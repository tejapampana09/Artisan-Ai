"""
ONDC Acknowledgement and Callback Schemas.
Standard Beckn ACK/NACK responses and error structures.
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class ONDCAck(BaseModel):
    status: str = Field(..., description="'ACK' or 'NACK'")

class ONDCError(BaseModel):
    type: str = Field(..., description="Error category e.g. CONTEXT-ERROR, AUTH-ERROR, DOMAIN-ERROR")
    code: str = Field(..., description="ONDC protocol error code, e.g. 10001")
    path: Optional[str] = None
    message: str = Field(..., description="Human-readable description of protocol error")

class ONDCAckMessage(BaseModel):
    ack: ONDCAck

class ONDCAckResponse(BaseModel):
    message: ONDCAckMessage
    error: Optional[ONDCError] = None

def make_ack() -> Dict[str, Any]:
    return {"message": {"ack": {"status": "ACK"}}}

def make_nack(error_type: str, code: str, message: str) -> Dict[str, Any]:
    return {
        "message": {"ack": {"status": "NACK"}},
        "error": {
            "type": error_type,
            "code": code,
            "message": message
        }
    }
