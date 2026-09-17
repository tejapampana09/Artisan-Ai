from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from backend.app.services.auth import get_current_user
from backend.app.models import User, Product
from backend.app.database import get_db
from sqlalchemy.orm import Session
from backend.app.integrations.marketplace import InternalMarketplaceAdapter, MockMarketplaceAdapter
from backend.app.integrations.ondc import ondc_config, ondc_status_tracker, is_product_ondc_eligible

router = APIRouter(prefix="/api/channels", tags=["Sales Channels"])

class ChannelPublishRequest(BaseModel):
    product_id: int
    channel_name: str # "INTERNAL", "EXPORT_HUB_SANDBOX", or "ONDC"

@router.get("/list")
def list_sales_channels(current_user: User = Depends(get_current_user)):
    """
    Returns available sales channel providers.
    Explicitly labels mock/sandbox channels to prevent false external claims.
    Reports honest ONDC network verification status.
    """
    ondc_report = ondc_status_tracker.get_status_report(ondc_config)
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
            "id": "ONDC",
            "name": "Open Network for Digital Commerce (ONDC Retail)",
            "type": "ONDC_NETWORK",
            "status": ondc_report["verification_status"],
            "is_real_integration": True,
            "is_mock": False,
            "description": "National e-commerce discoverability channel via ONDC Retail network (Beckn Protocol v1.2)."
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if req.channel_name == "INTERNAL":
        adapter = InternalMarketplaceAdapter()
        return adapter.publish_product({"id": req.product_id})
    elif req.channel_name == "EXPORT_HUB_SANDBOX":
        adapter = MockMarketplaceAdapter(channel_name=req.channel_name)
        return adapter.publish_product({"id": req.product_id})
    elif req.channel_name == "ONDC":
        product = db.query(Product).filter(Product.id == req.product_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        if not is_product_ondc_eligible(product):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Product is not eligible for ONDC discoverability. Must be PUBLISHED, in stock, with valid price and active artisan ownership."
            )
        ondc_report = ondc_status_tracker.get_status_report(ondc_config)
        return {
            "channel": "ONDC",
            "status": "ONDC_ELIGIBLE",
            "is_real_integration": True,
            "verification_status": ondc_report["verification_status"],
            "message": "Product is verified and eligible for ONDC network discovery.",
            "product_id": product.id
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown sales channel '{req.channel_name}'"
        )

