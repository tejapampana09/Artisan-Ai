from typing import Dict, Any
from backend.app.integrations.marketplace.base import BaseMarketplaceAdapter

class MockMarketplaceAdapter(BaseMarketplaceAdapter):
    """
    Mock / Sandbox Marketplace Adapter for External Channels (ONDC Network, Export Hubs).
    Strict Rule: Explicitly labelled as Mock/Sandbox. Never claims real external publishing.
    """

    def __init__(self, channel_name: str = "ONDC_SANDBOX"):
        self.channel_name = channel_name

    def publish_product(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "channel": self.channel_name,
            "status": "SANDBOX_SIMULATED",
            "is_real_integration": False,
            "is_mock": True,
            "notice": f"Simulated publish to {self.channel_name} sandbox environment. No live external network credentials configured.",
            "product_id": product_data.get("id")
        }

    def update_product(self, product_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "channel": self.channel_name,
            "status": "SANDBOX_UPDATED",
            "is_mock": True,
            "product_id": product_id
        }

    def remove_product(self, product_id: int) -> Dict[str, Any]:
        return {
            "channel": self.channel_name,
            "status": "SANDBOX_REMOVED",
            "is_mock": True,
            "product_id": product_id
        }

    def get_sync_status(self, product_id: int) -> Dict[str, Any]:
        return {
            "channel": self.channel_name,
            "sync_status": "SANDBOX_READY",
            "is_mock": True,
            "product_id": product_id
        }
