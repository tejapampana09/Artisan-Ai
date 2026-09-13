import os
import re
import logging
import httpx
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from urllib.parse import unquote, urlparse

logger = logging.getLogger("artisan_ai")

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
    Default production fallback provider when no external market search API is configured.
    Guarantees production safety: does NOT return fake mock data to real users.
    """

    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        return []

class WebSearchMarketResearchProvider(BaseMarketResearchProvider):
    """
    Real Web Search Market Research Provider.
    Queries live search APIs / web search indexes for real e-commerce & handicraft marketplace listings,
    extracting titles, prices, source platforms, and product URLs for market median computation.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("MARKET_RESEARCH_API_KEY", "").strip()

    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        if not query or not query.strip():
            return []

        clean_q = query.strip()
        search_terms = [
            f"{clean_q} price INR buy online",
            f"{clean_q} handicraft price rupees",
            f"buy {clean_q} online"
        ]

        results: List[Dict[str, Any]] = []
        seen_urls = set()

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Content-Type": "application/x-www-form-urlencoded"
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                for term in search_terms:
                    if len(results) >= limit:
                        break

                    try:
                        resp = await client.post("https://lite.duckduckgo.com/lite/", data={"q": term}, headers=headers)
                        if resp.status_code != 200:
                            continue

                        html = resp.text
                        matches = re.findall(r'<a[^>]*href=["\']([^"\']+)["\'][^>]*class=["\']result-link["\'][^>]*>(.*?)</a>', html, re.DOTALL)
                        snippets = re.findall(r'<td[^>]*class=["\']result-snippet["\'][^>]*>(.*?)</td>', html, re.DOTALL)

                        for i, (raw_url, raw_title) in enumerate(matches):
                            if len(results) >= limit:
                                break

                            clean_title = re.sub(r'<[^>]+>', '', raw_title).strip()
                            clean_snippet = re.sub(r'<[^>]+>', '', snippets[i]).strip() if i < len(snippets) else ""

                            if not clean_title or "duckduckgo.com" in raw_url:
                                continue

                            actual_url = raw_url
                            if 'uddg=' in raw_url:
                                m = re.search(r'uddg=([^&]+)', raw_url)
                                if m:
                                    actual_url = unquote(m.group(1))

                            url_key = actual_url.lower()
                            if url_key in seen_urls:
                                continue
                            seen_urls.add(url_key)

                            domain = urlparse(actual_url).netloc.replace('www.', '').capitalize()
                            source = domain if domain else "CraftMarketplace"

                            combined_text = f"{clean_title} {clean_snippet}"

                            # Multi-pattern price extraction in INR
                            patterns = [
                                r'(?:₹|Rs\.?|INR|\$)\s?([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)',
                                r'([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)\s?(?:/-|Rs|rupees|INR)',
                                r'(?:price|cost|at|starts at|from)\s+(?:₹|Rs\.?|INR)?\s?([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)'
                            ]

                            parsed_price: Optional[float] = None
                            for pat in patterns:
                                price_matches = re.findall(pat, combined_text, re.IGNORECASE)
                                if price_matches:
                                    for p_str in price_matches:
                                        clean_p = p_str.replace(',', '')
                                        try:
                                            p_val = float(clean_p)
                                            if 50 <= p_val <= 500000:
                                                parsed_price = p_val
                                                break
                                        except ValueError:
                                            continue
                                if parsed_price is not None:
                                    break

                            results.append({
                                "title": clean_title,
                                "price": parsed_price,
                                "currency": "INR",
                                "source": source,
                                "url": actual_url,
                                "description": clean_snippet,
                                "category": query,
                                "materials": [],
                                "observed_at": datetime.now(timezone.utc)
                            })
                    except Exception as err:
                        logger.warning("Web search provider request failed for term '%s': %s", term, err)
                        continue
        except Exception as err:
            logger.warning("Web search provider client initialization failed: %s", err)
            return []

        return results[:limit]

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

def get_default_market_research_provider() -> BaseMarketResearchProvider:
    """
    Factory function resolving active production/staging market research provider.
    Priority:
    1. If MARKET_RESEARCH_PROVIDER env == 'MOCK', return MockMarketResearchProvider (unit tests only).
    2. If MARKET_RESEARCH_PROVIDER env == 'NOOP', return NoOpMarketResearchProvider.
    3. Default in production & live development: return WebSearchMarketResearchProvider.
    """
    prov_setting = os.getenv("MARKET_RESEARCH_PROVIDER", "WEB_SEARCH").strip().upper()
    if prov_setting == "MOCK":
        return MockMarketResearchProvider()
    elif prov_setting == "NOOP":
        return NoOpMarketResearchProvider()
    return WebSearchMarketResearchProvider()

