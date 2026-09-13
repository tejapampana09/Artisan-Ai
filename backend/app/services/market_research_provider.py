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

class GeminiGroundingMarketResearchProvider(BaseMarketResearchProvider):
    """
    Gemini + Google Search Grounding Market Research Provider.
    Leverages Gemini API with google_search grounding tools to query live Google search results,
    normalizing product titles, prices in INR, source marketplace platforms, and citations.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "").strip()

    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        if not query or not query.strip() or not self.api_key:
            return []

        clean_q = query.strip()
        results: List[Dict[str, Any]] = []
        from backend.app.config import GEMINI_MODEL
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={self.api_key}"
        prompt = f"""Search live Google Search for current e-commerce product listings in India for: "{clean_q}".
Find real comparable product listings available for sale online in India (e.g. on Myntra, Meesho, Amazon, Craftsvilla, iTokri, Ajio, FlipKart, etc.).
Extract real product listings and their prices in Indian Rupees (INR).

Return ONLY a JSON array of product listing objects with this schema:
[
  {{
    "title": "Exact product title from marketplace",
    "price": 1299.0,
    "currency": "INR",
    "source": "Marketplace/Store Name (e.g. Myntra)",
    "url": "Product page URL if available, else empty string",
    "description": "Short description or snippet"
  }}
]
Do NOT include markdown formatting outside the JSON array."""

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "tools": [{"google_search": {}}],
            "generationConfig": {"temperature": 0.1}
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                if resp.status_code == 200:
                    res_json = resp.json()
                    candidates = res_json.get("candidates", [])
                    if candidates:
                        cand = candidates[0]
                        parts = cand.get("content", {}).get("parts", [])
                        if parts:
                            text_raw = parts[0].get("text", "").strip()
                            if text_raw.startswith("```"):
                                lines = text_raw.split("\n")
                                if lines[0].startswith("```"):
                                    lines = lines[1:]
                                if lines and lines[-1].strip() == "```":
                                    lines = lines[:-1]
                                text_raw = "\n".join(lines).strip()

                            parsed_array = json.loads(text_raw)
                            if isinstance(parsed_array, list):
                                for item in parsed_array:
                                    if not isinstance(item, dict):
                                        continue
                                    title = str(item.get("title") or "").strip()
                                    if not title:
                                        continue
                                    raw_p = item.get("price")
                                    parsed_price = None
                                    if raw_p is not None:
                                        try:
                                            p_val = float(raw_p)
                                            if 50 <= p_val <= 500000:
                                                parsed_price = p_val
                                        except (ValueError, TypeError):
                                            pass

                                    url_val = str(item.get("url") or "")
                                    domain = urlparse(url_val).netloc.replace("www.", "").capitalize() if url_val else "CraftMarketplace"
                                    source = str(item.get("source") or domain or "CraftMarketplace")

                                    results.append({
                                        "title": title,
                                        "price": parsed_price,
                                        "currency": "INR",
                                        "source": source,
                                        "url": url_val,
                                        "description": str(item.get("description") or ""),
                                        "category": clean_q,
                                        "materials": [],
                                        "observed_at": datetime.now(timezone.utc)
                                    })
        except Exception as err:
            logger.warning("Gemini Search Grounding request failed for query '%s': %s", clean_q, err)

        return results[:limit]

class WebSearchMarketResearchProvider(BaseMarketResearchProvider):
    """
    Real Web Search Market Research Provider.
    Queries live search APIs / web search indexes (Gemini Search Grounding, Serper API, Bing Web Search)
    for real e-commerce & handicraft marketplace listings, extracting titles, prices in INR, source platforms,
    and product URLs for market median computation.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("MARKET_RESEARCH_API_KEY", "").strip()
        self.gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.gemini_grounding_provider = GeminiGroundingMarketResearchProvider(self.gemini_key)

    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        if not query or not query.strip():
            return []

        clean_q = query.strip()
        results: List[Dict[str, Any]] = []
        seen_urls = set()

        # 1. Primary: Gemini + Google Search Grounding (if GEMINI_API_KEY is available)
        if self.gemini_key:
            try:
                g_items = await self.gemini_grounding_provider.search_comparable_products(clean_q, limit=limit)
                for item in g_items:
                    url_key = (item.get("url") or item.get("title", "")).lower()
                    if url_key and url_key not in seen_urls:
                        seen_urls.add(url_key)
                        results.append(item)
            except Exception as err:
                logger.warning("Gemini grounding market search failed for query '%s': %s", clean_q, err)

        # 2. Secondary: Serper API live search (if Serper API key available and results < limit)
        if len(results) < limit and self.api_key:
            try:
                serper_items = await self._search_serper(clean_q, limit=limit - len(results))
                for item in serper_items:
                    url_key = (item.get("url") or item.get("title", "")).lower()
                    if url_key and url_key not in seen_urls:
                        seen_urls.add(url_key)
                        results.append(item)
            except Exception as err:
                logger.warning("Serper market search request failed for query '%s': %s", clean_q, err)

        return results[:limit]

    async def _search_serper(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        results = []
        headers = {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            # Primary: /shopping endpoint — has real prices
            try:
                shop_payload = {"q": query, "gl": "in", "num": min(limit, 20)}
                resp = await client.post("https://google.serper.dev/shopping", json=shop_payload, headers=headers)
                if resp.status_code == 200:
                    for item in resp.json().get("shopping", []):
                        if len(results) >= limit:
                            break
                        title = (item.get("title") or "").strip()
                        if not title:
                            continue
                        raw_price_str = item.get("price") or ""
                        parsed_price = None
                        if raw_price_str:
                            clean = re.sub(r"[^\d.]", "", str(raw_price_str))
                            try:
                                v = float(clean)
                                if 50 <= v <= 500000:
                                    parsed_price = v
                            except (ValueError, TypeError):
                                pass
                        url = item.get("link") or ""
                        source = item.get("source") or urlparse(url).netloc.replace("www.", "").capitalize() or "CraftMarketplace"
                        results.append({
                            "title": title,
                            "price": parsed_price,
                            "currency": "INR",
                            "source": source,
                            "url": url,
                            "description": item.get("snippet") or "",
                            "category": query,
                            "materials": [],
                            "observed_at": datetime.now(timezone.utc)
                        })
            except Exception as err:
                logger.warning("Serper /shopping failed for '%s': %s", query, err)

            # Fallback: /search organic results if shopping didn't fill limit
            if len(results) < limit:
                try:
                    search_payload = {"q": f"{query} buy online India price INR", "gl": "in", "hl": "en"}
                    resp = await client.post("https://google.serper.dev/search", json=search_payload, headers=headers)
                    if resp.status_code == 200:
                        res_json = resp.json()
                        raw_candidates = res_json.get("shopping", []) + res_json.get("organic", [])
                        for cand in raw_candidates:
                            if len(results) >= limit:
                                break
                            title = (cand.get("title") or "").strip()
                            url = cand.get("link") or cand.get("url") or ""
                            snippet = cand.get("snippet") or cand.get("description") or ""
                            if not title or "google.com" in url:
                                continue
                            domain = urlparse(url).netloc.replace("www.", "").capitalize() if url else "CraftMarketplace"
                            source = cand.get("source") or domain or "CraftMarketplace"
                            parsed_price = self._extract_price(cand.get("price"), title, snippet)
                            results.append({
                                "title": title,
                                "price": parsed_price,
                                "currency": "INR",
                                "source": source,
                                "url": url,
                                "description": snippet,
                                "category": query,
                                "materials": [],
                                "observed_at": datetime.now(timezone.utc)
                            })
                except Exception as err:
                    logger.warning("Serper /search fallback failed for '%s': %s", query, err)

        return results

    def _extract_price(self, direct_price: Any, title: str, snippet: str) -> Optional[float]:
        if direct_price is not None:
            if isinstance(direct_price, (int, float)) and direct_price > 0:
                return float(direct_price)
            if isinstance(direct_price, str):
                clean = re.sub(r'[^\d.]', '', direct_price)
                try:
                    val = float(clean)
                    if 50 <= val <= 500000:
                        return val
                except ValueError:
                    pass

        combined_text = f"{title} {snippet}"
        patterns = [
            r'(?:₹|Rs\.?|INR|\$)\s?([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)',
            r'([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)\s?(?:/-|Rs|rupees|INR)',
            r'(?:price|cost|at|starts at|from)\s+(?:₹|Rs\.?|INR)?\s?([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)'
        ]

        for pat in patterns:
            price_matches = re.findall(pat, combined_text, re.IGNORECASE)
            if price_matches:
                for p_str in price_matches:
                    clean_p = p_str.replace(',', '')
                    try:
                        p_val = float(clean_p)
                        if 50 <= p_val <= 500000:
                            return p_val
                    except ValueError:
                        continue
        return None

class MockMarketResearchProvider(BaseMarketResearchProvider):
    """
    Deterministic mock provider for unit tests and offline demonstration.
    """

    def __init__(self, mock_listings: Optional[List[Dict[str, Any]]] = None):
        self._mock_listings = mock_listings

    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        if self._mock_listings is not None:
            results = []
            for idx, item in enumerate(self._mock_listings[:limit]):
                item_copy = dict(item)
                if "url" not in item_copy:
                    item_copy["url"] = f"https://example.com/mock/{idx+1}"
                results.append(item_copy)
            return results

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

