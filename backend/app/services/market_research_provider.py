from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

class BaseMarketResearchProvider(ABC):
    """
    Abstract interface/protocol for external market research product providers.
    Decouples market discovery from specific external APIs or search engines.
    """

    @abstractmethod
    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Searches comparable external product listings.
        Returns a list of dictionaries containing listing attributes:
        title, price, currency, source, url, description, category, materials, observed_at
        """
        raise NotImplementedError

class NoOpMarketResearchProvider(BaseMarketResearchProvider):
    """
    Default production provider when no external market search API is configured.
    Guarantees production safety: does NOT return fake mock data to real users.
    """

    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        return []

class MockMarketResearchProvider(BaseMarketResearchProvider):
    """
    Deterministic mock provider for unit tests and offline demonstration.
    """

    def __init__(self, mock_listings: Optional[List[Dict[str, Any]]] = None):
        self._mock_listings = mock_listings

    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        if self._mock_listings is not None:
            return self._mock_listings[:limit]

        now = datetime.now(timezone.utc)
        q_lower = query.lower()

        # Generate realistic mock candidates based on query terms
        all_candidates = [
            {
                "title": "Handmade Bamboo Storage Basket",
                "price": 850.0,
                "currency": "INR",
                "source": "CraftMarketplace",
                "url": "https://example.com/item/1",
                "description": "Natural woven bamboo basket for home storage.",
                "category": "Basketry",
                "materials": ["Bamboo"],
                "observed_at": now
            },
            {
                "title": "Handwoven Bamboo Utility Basket",
                "price": 650.0,
                "currency": "INR",
                "source": "ArtisanHub",
                "url": "https://example.com/item/2",
                "description": "Traditional eco-friendly bamboo basket.",
                "category": "Basketry",
                "materials": ["Bamboo"],
                "observed_at": now
            },
            {
                "title": "Decorative Bamboo Fruit Bowl",
                "price": 1100.0,
                "currency": "INR",
                "source": "HandicraftStore",
                "url": "https://example.com/item/3",
                "description": "Polished bamboo decorative bowl.",
                "category": "Home Decor",
                "materials": ["Bamboo"],
                "observed_at": now
            },
            {
                "title": "Plastic Storage Box Basket",
                "price": 250.0,
                "currency": "INR",
                "source": "MegaRetail",
                "url": "https://example.com/item/4",
                "description": "Synthetic plastic container box.",
                "category": "Storage",
                "materials": ["Plastic"],
                "observed_at": now
            },
            {
                "title": "Terracotta Ceramic Water Jug",
                "price": 500.0,
                "currency": "INR",
                "source": "EarthenPots",
                "url": "https://example.com/item/5",
                "description": "Handmade clay terracotta pot.",
                "category": "Pottery",
                "materials": ["Terracotta", "Clay"],
                "observed_at": now
            }
        ]

        return all_candidates[:limit]
