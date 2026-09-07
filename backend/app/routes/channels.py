from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from backend.app.services.auth import get_current_user
from backend.app.models import User
from backend.app.integrations.marketplace import InternalMarketplaceAdapter, MockMarketplaceAdapter

router = APIRouter(prefix="/api/channels", tags=["Sales Channels"])

class ChannelPublishRequest(BaseModel):
    product_id: int
    channel_name: str # "INTERNAL", "ONDC_SANDBOX", "EXPORT_HUB_SANDBOX"

@router.get("/list")
def list_sales_channels(current_user: User = Depends(get_current_user)):
    """
    Returns available sales channel providers.
    Explicitly labels mock/sandbox channels to prevent false external claims.
    """
    return [
        {
            "id": "INTERNAL",
            "name": "Artisan-AI Direct Marketplace",
            "type": "INTERNAL",
            "status": "ACTIVE",
            "is_real_integration": True,
            "description": "Primary direct-to-consumer buyer marketplace with Craft Passport & Fair Price seal."
        },
        {
            "id": "ONDC_SANDBOX",
            "name": "ONDC Network (Sandbox)",
            "type": "EXTERNAL_MOCK",
            "status": "SANDBOX_READY",
            "is_real_integration": False,
            "is_mock": True,
            "description": "Simulated ONDC protocol channel adapter for network readiness testing."
        },
        {
            "id": "EXPORT_HUB_SANDBOX",
            "name": "Global Heritage Export Hub (Sandbox)",
            "type": "EXTERNAL_MOCK",
            "status": "SANDBOX_READY",
            "is_real_integration": False,
            "is_mock": True,
            "description": "Simulated international craft export channel adapter."
        }
    ]

@router.post("/publish")
def publish_to_channel(
    req: ChannelPublishRequest,
    current_user: User = Depends(get_current_user)
):
    if req.channel_name == "INTERNAL":
        adapter = InternalMarketplaceAdapter()
    elif req.channel_name in ["ONDC_SANDBOX", "EXPORT_HUB_SANDBOX"]:
        adapter = MockMarketplaceAdapter(channel_name=req.channel_name)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown sales channel '{req.channel_name}'"
        )

    result = adapter.publish_product({"id": req.product_id})
    return result
