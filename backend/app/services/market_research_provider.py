import os
import re
import json
import logging
import httpx
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from urllib.parse import urlparse

import hashlib
import time
from typing import Tuple

logger = logging.getLogger("artisan_ai")

_MARKET_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
MARKET_CACHE_TTL_SECONDS = 1800  # 30-minute TTL cache window

def get_market_cache(query: str) -> Optional[List[Dict[str, Any]]]:
    key = hashlib.sha256(query.lower().strip().encode("utf-8")).hexdigest()
    if key in _MARKET_CACHE:
        ts, data = _MARKET_CACHE[key]
        if time.time() - ts < MARKET_CACHE_TTL_SECONDS:
            logger.info("[Market Cache] HIT for query '%s' (%d cached items)", query, len(data))
            return data
        else:
            del _MARKET_CACHE[key]
    return None

def set_market_cache(query: str, results: List[Dict[str, Any]]):
    key = hashlib.sha256(query.lower().strip().encode("utf-8")).hexdigest()
    _MARKET_CACHE[key] = (time.time(), results)


class BaseMarketResearchProvider(ABC):
    @abstractmethod
    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        raise NotImplementedError


class NoOpMarketResearchProvider(BaseMarketResearchProvider):
    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        return []


def _extract_json_array(text: str) -> Optional[list]:
    """Robustly extracts JSON array from text, including recovery from partial/truncated JSON."""
    if not text:
        return None
    text = re.sub(r"^```[a-zA-Z]*\n?", "", text.strip())
    text = re.sub(r"\n?```$", "", text.strip())
    
    # Try direct parse
    try:
        parsed = json.loads(text.strip())
        if isinstance(parsed, list):
            return parsed
    except Exception:
        pass

    start = text.find("[")
    if start == -1:
        return None

    # First attempt: standard [ ... ] boundary
    end = text.rfind("]")
    if end > start:
        snippet = text[start:end + 1]
        try:
            parsed = json.loads(snippet)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            cleaned = re.sub(r",\s*([\]}])", r"\1", snippet)
            try:
                parsed = json.loads(cleaned)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass

    # Second attempt: truncated response recovery. Find the last complete object '}' and close with ']'
    last_brace = text.rfind("}")
    if last_brace > start:
        recovered = text[start:last_brace + 1].rstrip().rstrip(",") + "]"
        try:
            parsed = json.loads(recovered)
            if isinstance(parsed, list) and len(parsed) > 0:
                logger.info("[Market] Successfully recovered %d listings from truncated JSON", len(parsed))
                return parsed
        except Exception:
            pass

    return None


def _clean_or_build_url(url_val: str, title: str, source: str) -> str:
    url_clean = (url_val or "").strip()
    is_dummy = (
        not url_clean or
        any(dummy in url_clean.lower() for dummy in ["example.com", "placeholder", "b08example", "fake-unsupported", "test"])
    )
    if not is_dummy and (url_clean.startswith("http://") or url_clean.startswith("https://")):
        return url_clean
    
    import urllib.parse
    q = urllib.parse.quote_plus(title or "handmade product")
    src = (source or "").lower()
    url_low = url_clean.lower()
    if "amazon" in src or "amazon" in url_low:
        return f"https://www.amazon.in/s?k={q}"
    elif "flipkart" in src or "flipkart" in url_low:
        return f"https://www.flipkart.com/search?q={q}"
    elif "meesho" in src or "meesho" in url_low:
        return f"https://www.meesho.com/search?q={q}"
    elif "etsy" in src or "etsy" in url_low:
        return f"https://www.etsy.com/in-en/search?q={q}"
    return f"https://www.google.com/search?q={q}+buy+online+India"

def _is_url_in_grounding(url: str, grounded_uris: set) -> bool:
    """Verifies that a product URL matches or derives from a grounded web search URI in groundingMetadata."""
    if not url or not isinstance(url, str):
        return False
    url_clean = url.strip()
    if not (url_clean.startswith("http://") or url_clean.startswith("https://")):
        return False
    
    if url_clean in grounded_uris:
        return True
    
    url_lower = url_clean.lower().rstrip("/")
    for g_uri in grounded_uris:
        g_lower = g_uri.lower().rstrip("/")
        if url_lower == g_lower:
            return True
        
        try:
            p_url = urlparse(url_lower)
            p_g = urlparse(g_lower)
            if p_url.netloc and p_url.netloc == p_g.netloc:
                if p_url.path and p_url.path != "/" and p_url.path == p_g.path:
                    return True
        except Exception:
            pass
    return False


class GeminiGroundingMarketResearchProvider(BaseMarketResearchProvider):
    """
    Production Live Market Research Provider utilizing Google Gemini with Search Grounding.
    Searches the live web for real, currently available Indian handmade/artisan products
    with grounded URLs and verified observed prices in INR.
    """

    def __init__(self, api_key: Optional[str] = None):
        if not api_key:
            try:
                from backend.app.config import GEMINI_API_KEY
                api_key = GEMINI_API_KEY
            except Exception:
                pass
        self.api_key = (api_key or os.getenv("GEMINI_API_KEY", "")).strip()

    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        if not query or not query.strip():
            return []
        
        clean_q = query.strip()
        cached_res = get_market_cache(clean_q)
        if cached_res is not None:
            return cached_res[:limit]

        if not self.api_key:
            try:
                from backend.app.config import GEMINI_API_KEY
                self.api_key = GEMINI_API_KEY.strip()
            except Exception:
                pass
        
        if not self.api_key:
            logger.warning("[Market] No GEMINI_API_KEY configured")
            return []

        fetch_count = min(max(limit, 3), 5)

        from backend.app.config import GEMINI_MODEL, GEMINI_FALLBACK_MODELS

        fallback_list = GEMINI_FALLBACK_MODELS if isinstance(GEMINI_FALLBACK_MODELS, list) else [m.strip() for m in str(GEMINI_FALLBACK_MODELS).split(",") if m.strip()]
        models_to_try = [GEMINI_MODEL] + [m for m in fallback_list if m != GEMINI_MODEL]

        prompt = (
            f"You are an expert Indian retail and handicraft market research analyst. "
            f"Search the live web for currently available comparable handmade or artisan products in India for: \"{clean_q}\". "
            f"Find actual observed prices in INR from real grounded web search results on platforms in India. "
            f"Return ONLY a valid JSON array of up to {fetch_count} objects with keys: "
            f"title (product title), price (actual observed numeric price in INR), currency ('INR'), "
            f"source (marketplace or store name), description, category, materials (list of strings).\n"
            f"Only include products whose price and source are supported by the grounded search results. "
            f"Never invent prices or fabricate listings.\n"
            f"Example:\n"
            f"[{{\"title\":\"Handcrafted {clean_q}\",\"price\":499.0,\"currency\":\"INR\",\"source\":\"Amazon India\",\"description\":\"Handmade item\",\"category\":\"{clean_q}\",\"materials\":[\"Handcraft\"]}}]"
        )

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "tools": [
                {
                    "google_search": {}
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 4096,
                "responseMimeType": "application/json"
            }
        }

        for model in models_to_try:
            try:
                api_url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{model}:generateContent?key={self.api_key}"
                )
                async with httpx.AsyncClient(timeout=12.0) as client:
                    resp = await client.post(api_url, json=payload, headers={"Content-Type": "application/json"})

                if resp.status_code == 429:
                    logger.warning("[Market] Gemini model %s quota exceeded (429), trying next model", model)
                    continue

                if resp.status_code != 200:
                    logger.warning("[Market] Gemini model %s returned HTTP %s", model, resp.status_code)
                    continue

                res_json = resp.json()
                if not isinstance(res_json, dict):
                    continue

                candidates = res_json.get("candidates")
                if not candidates or not isinstance(candidates, list):
                    continue

                candidate = candidates[0]
                if not isinstance(candidate, dict):
                    continue

                # Grounding failure check: groundingMetadata is mandatory
                grounding_metadata = candidate.get("groundingMetadata")
                if not grounding_metadata or not isinstance(grounding_metadata, dict):
                    logger.warning("[Market] Gemini model %s returned response without groundingMetadata", model)
                    continue

                grounding_chunks = grounding_metadata.get("groundingChunks")
                if not isinstance(grounding_chunks, list):
                    grounding_chunks = []

                grounded_uris = set()
                grounded_chunks_list = []
                for chunk in grounding_chunks:
                    if isinstance(chunk, dict):
                        web_info = chunk.get("web")
                        if isinstance(web_info, dict):
                            uri = web_info.get("uri")
                            if uri and isinstance(uri, str) and uri.strip():
                                u_clean = uri.strip()
                                if u_clean.startswith("http://") or u_clean.startswith("https://"):
                                    grounded_uris.add(u_clean)
                                    grounded_chunks_list.append({
                                        "uri": u_clean,
                                        "title": str(web_info.get("title") or "").strip(),
                                        "domain": urlparse(u_clean).netloc.lower()
                                    })

                if not grounded_uris:
                    logger.warning("[Market] Gemini model %s groundingMetadata contained no grounded URIs", model)
                    continue

                content_parts = candidate.get("content", {}).get("parts", [])
                if not isinstance(content_parts, list):
                    content_parts = []

                all_text = "".join(p.get("text", "") for p in content_parts if isinstance(p, dict))
                parsed_array = _extract_json_array(all_text)
                if not parsed_array:
                    logger.warning("[Market] Gemini %s could not parse JSON: %s", model, all_text[:200])
                    continue

                results = []
                for idx, item in enumerate(parsed_array):
                    if not isinstance(item, dict):
                        continue
                    title = str(item.get("title") or "").strip()
                    if not title:
                        continue

                    raw_p = item.get("price")
                    parsed_price = None
                    if raw_p is not None:
                        try:
                            p_val = float(str(raw_p).replace(",", "").replace("₹", "").strip())
                            if p_val > 0:
                                parsed_price = p_val
                        except (ValueError, TypeError):
                            pass

                    source = str(item.get("source") or "Web Search").strip()
                    raw_url = str(item.get("url") or "").strip()

                    # Direct Grounding Source URL Resolution:
                    # Backend owns URL mapping derived directly from authoritative groundingMetadata
                    matched_uri = None
                    if raw_url and _is_url_in_grounding(raw_url, grounded_uris):
                        matched_uri = raw_url
                    
                    if not matched_uri:
                        # Match grounded URI by domain/source or title
                        src_low = source.lower()
                        title_low = title.lower()
                        for g in grounded_chunks_list:
                            if g["domain"] and (g["domain"] in src_low or src_low in g["domain"]):
                                matched_uri = g["uri"]
                                break
                            if g["title"] and (g["title"].lower() in title_low or title_low in g["title"].lower()):
                                matched_uri = g["uri"]
                                break

                    # Strict Grounding Provenance Gate:
                    # A price-bearing comparable MUST derive directly from an authentic web URI in groundingMetadata.
                    # Artificial or synthesized search URLs are strictly forbidden for pricing comparables.
                    if not matched_uri:
                        logger.info("[Market] Rejecting listing '%s' - no verified grounded web source URI found in groundingMetadata", title)
                        continue

                    final_url = matched_uri

                    results.append({
                        "title": title,
                        "price": parsed_price,
                        "currency": "INR",
                        "source": source,
                        "url": final_url,
                        "description": str(item.get("description") or ""),
                        "category": str(item.get("category") or clean_q),
                        "materials": item.get("materials") or [],
                        "observed_at": datetime.now(timezone.utc)
                    })

                if results:
                    logger.info("[Market] Gemini %s successfully returned %d grounded comparable listings for '%s'", model, len(results), clean_q)
                    return results[:limit]

            except Exception as err:
                logger.warning("[Market] Gemini request error on %s for query '%s': %s", model, clean_q, err)

        logger.warning("[Market] All Gemini models exhausted or ungrounded for query '%s'", clean_q)
        return []


class MockMarketResearchProvider(BaseMarketResearchProvider):
    def __init__(self, mock_listings=None):
        self._mock_listings = mock_listings

    async def search_comparable_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        if self._mock_listings is not None:
            results = []
            for idx, item in enumerate(self._mock_listings[:limit]):
                item_copy = dict(item)
                if "url" not in item_copy:
                    item_copy["url"] = f"https://example.com/mock/{idx+1}"
                results.append(item_copy)
            return results
        return [
            {"title": "Handmade Bamboo Basket", "price": 850.0, "currency": "INR", "source": "Amazon India", "url": "https://www.amazon.in/s?k=bamboo+basket", "description": "Natural woven basket.", "category": query, "materials": ["Bamboo"], "observed_at": now},
            {"title": "Handwoven Utility Basket", "price": 650.0, "currency": "INR", "source": "Flipkart", "url": "https://www.flipkart.com/search?q=utility+basket", "description": "Eco basket.", "category": query, "materials": ["Bamboo"], "observed_at": now},
        ][:limit]


WebSearchMarketResearchProvider = GeminiGroundingMarketResearchProvider


def get_default_market_research_provider() -> BaseMarketResearchProvider:
    prov_setting = os.getenv("MARKET_RESEARCH_PROVIDER", "WEB_SEARCH").strip().upper()
    if prov_setting == "MOCK":
        return MockMarketResearchProvider()
    if prov_setting == "NOOP":
        return NoOpMarketResearchProvider()
    return GeminiGroundingMarketResearchProvider()
