import os
import re
import json
import logging
import httpx
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from urllib.parse import urlparse

logger = logging.getLogger("artisan_ai")


class BaseMarketResearchProvider(ABC):
    @abstractmethod
    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        raise NotImplementedError


class NoOpMarketResearchProvider(BaseMarketResearchProvider):
    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        return []


def _extract_json_array(text: str) -> Optional[list]:
    if not text:
        return None
    text = re.sub(r"^```[a-zA-Z]*\n?", "", text.strip())
    text = re.sub(r"\n?```$", "", text.strip())
    try:
        parsed = json.loads(text.strip())
        if isinstance(parsed, list):
            return parsed
    except Exception:
        pass
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end > start:
        try:
            parsed = json.loads(text[start:end + 1])
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
    return None


class GeminiGroundingMarketResearchProvider(BaseMarketResearchProvider):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "").strip()

    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        if not query or not query.strip() or not self.api_key:
            return []

        clean_q = query.strip()
        from backend.app.config import GEMINI_MODEL, GEMINI_FALLBACK_MODELS

        fallback_list = GEMINI_FALLBACK_MODELS if isinstance(GEMINI_FALLBACK_MODELS, list) else [m.strip() for m in str(GEMINI_FALLBACK_MODELS).split(",") if m.strip()]
        models_to_try = [GEMINI_MODEL] + fallback_list

        prompt = (
            f'Search Google for current Indian e-commerce listings for: "{clean_q}". '
            f'Find products for sale on Amazon India, Flipkart, Meesho, Myntra, Craftsvilla, Etsy, '
            f'or any Indian handicraft marketplace. Extract up to {limit} real product listings with prices in INR. '
            f'Return ONLY a valid JSON array, no other text:\n'
            f'[{{"title":"...", "price":999.0, "currency":"INR", "source":"Amazon", "url":"...", "description":"..."}}]'
        )

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "tools": [{"google_search": {}}],
            "generationConfig": {"temperature": 0.0, "maxOutputTokens": 2048}
        }

        for model in models_to_try:
            try:
                api_url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{model}:generateContent?key={self.api_key}"
                )
                async with httpx.AsyncClient(timeout=25.0) as client:
                    resp = await client.post(api_url, json=payload, headers={"Content-Type": "application/json"})

                if resp.status_code == 429:
                    logger.warning("[Market] Gemini model %s quota exceeded, trying next", model)
                    continue
                if resp.status_code != 200:
                    logger.warning("[Market] Gemini model %s returned %s", model, resp.status_code)
                    continue

                res_json = resp.json()
                candidates = res_json.get("candidates", [])
                if not candidates:
                    continue

                all_text = ""
                for part in candidates[0].get("content", {}).get("parts", []):
                    all_text += part.get("text", "")

                parsed_array = _extract_json_array(all_text)
                if not parsed_array:
                    logger.warning("[Market] Gemini %s no parseable JSON. Raw: %s", model, all_text[:300])
                    continue

                results = []
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
                            p_val = float(str(raw_p).replace(",", "").replace("\u20b9", "").strip())
                            if 50 <= p_val <= 500000:
                                parsed_price = p_val
                        except (ValueError, TypeError):
                            pass
                    url_val = str(item.get("url") or "")
                    domain = urlparse(url_val).netloc.replace("www.", "").capitalize() if url_val else ""
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

                if results:
                    logger.info("[Market] Gemini %s returned %d listings for '%s'", model, len(results), clean_q)
                    return results[:limit]

            except Exception as err:
                logger.warning("[Market] Gemini grounding failed model=%s query='%s': %s", model, clean_q, err)

        logger.warning("[Market] All Gemini models exhausted for query '%s'", clean_q)
        return []


class MockMarketResearchProvider(BaseMarketResearchProvider):
    def __init__(self, mock_listings=None):
        self._mock_listings = mock_listings

    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        if self._mock_listings is not None:
            return [dict(item) for item in self._mock_listings[:limit]]
        return [
            {"title": "Handmade Bamboo Basket", "price": 850.0, "currency": "INR", "source": "CraftMarketplace", "url": "https://example.com/1", "description": "Natural woven basket.", "category": query, "materials": ["Bamboo"], "observed_at": now},
            {"title": "Handwoven Utility Basket", "price": 650.0, "currency": "INR", "source": "ArtisanHub", "url": "https://example.com/2", "description": "Eco basket.", "category": query, "materials": ["Bamboo"], "observed_at": now},
        ][:limit]


WebSearchMarketResearchProvider = GeminiGroundingMarketResearchProvider


def get_default_market_research_provider() -> BaseMarketResearchProvider:
    prov_setting = os.getenv("MARKET_RESEARCH_PROVIDER", "WEB_SEARCH").strip().upper()
    if prov_setting == "MOCK":
        return MockMarketResearchProvider()
    if prov_setting == "NOOP":
        return NoOpMarketResearchProvider()
    return GeminiGroundingMarketResearchProvider()
