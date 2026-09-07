from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseMarketplaceAdapter(ABC):
    """
    Sales Channel Marketplace Adapter Interface.
    Decouples core product catalog from external platforms (Internal, ONDC, Amazon, Shopify, Export channels).
    """

    @abstractmethod
    def publish_product(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """Publishes product to the marketplace channel."""
        pass

    @abstractmethod
    def update_product(self, product_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Updates product on the marketplace channel."""
        pass

    @abstractmethod
    def remove_product(self, product_id: int) -> Dict[str, Any]:
        """Removes product from the marketplace channel."""
        pass

    @abstractmethod
    def get_sync_status(self, product_id: int) -> Dict[str, Any]:
        """Checks synchronization status on the channel."""
        pass
