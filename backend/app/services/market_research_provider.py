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

def _market_cache_key(query: str, image_url: Optional[str] = None) -> str:
    """Keep visual searches separate from text-only searches for the same query."""
    payload = f"{query.lower().strip()}|{image_url or ''}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def get_market_cache(query: str, image_url: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
    key = _market_cache_key(query, image_url)
    if key in _MARKET_CACHE:
        ts, data = _MARKET_CACHE[key]
        if time.time() - ts < MARKET_CACHE_TTL_SECONDS:
            logger.info("[Market Cache] HIT for query '%s' (%d cached items)", query, len(data))
            return data
        else:
            del _MARKET_CACHE[key]
    return None

def set_market_cache(query: str, results: List[Dict[str, Any]], image_url: Optional[str] = None):
    key = _market_cache_key(query, image_url)
    _MARKET_CACHE[key] = (time.time(), results)


class BaseMarketResearchProvider(ABC):
    @abstractmethod
    async def search_comparable_products(
        self, query: str, limit: int = 10, image_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        raise NotImplementedError


class NoOpMarketResearchProvider(BaseMarketResearchProvider):
    async def search_comparable_products(
        self, query: str, limit: int = 10, image_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
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
        # Read by the orchestration layer to distinguish an unavailable live
        # provider from a genuine "no comparable products" search result.
        self.last_failure_reason: Optional[str] = None

    async def search_comparable_products(
        self, query: str, limit: int = 10, image_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        self.last_failure_reason = None
        if not query or not query.strip():
            return []
        
        clean_q = query.strip()
        cached_res = get_market_cache(clean_q, image_url)
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
            self.last_failure_reason = "Gemini Search is not configured on this server."
            return []

        fetch_count = min(max(limit, 3), 5)

        from backend.app.config import (
            MARKET_SEARCH_GEMINI_MODEL,
            MARKET_SEARCH_GEMINI_FALLBACK_MODELS,
        )

        # The grounded web lookup deliberately has its own model selection.
        # Do not silently use the catalog model when Search Grounding is not
        # allocated for it.
        fallback_list = (
            MARKET_SEARCH_GEMINI_FALLBACK_MODELS
            if isinstance(MARKET_SEARCH_GEMINI_FALLBACK_MODELS, list)
            else [m.strip() for m in str(MARKET_SEARCH_GEMINI_FALLBACK_MODELS).split(",") if m.strip()]
        )
        models_to_try = [MARKET_SEARCH_GEMINI_MODEL] + [
            m for m in fallback_list if m != MARKET_SEARCH_GEMINI_MODEL
        ]

        research_prompt = (
            f"You are an expert Indian retail and handicraft market research analyst. "
            f"Search the live web for currently available comparable handmade or artisan products in India for: \"{clean_q}\". "
            f"Prioritize authentic Indian artisan marketplaces and ONDC channels such as India Handmade (indiahandmade.com), Mystore (mystore.in), iTokri, Craftsvilla, Jaypore, Tribes India (tribesindia.com), and Khadi India (khadiindia.gov.in). "
            f"The attached craft photo is the primary visual reference; use its shape, material, pattern, craft style, and finish to reject text-only lookalikes. " if image_url else
            f"You are an expert Indian retail and handicraft market research analyst. Search the live web for currently available comparable handmade or artisan products in India for: \"{clean_q}\". "
            f"Prioritize authentic Indian artisan marketplaces and ONDC channels such as India Handmade (indiahandmade.com), Mystore (mystore.in), iTokri, Craftsvilla, Jaypore, Tribes India (tribesindia.com), and Khadi India (khadiindia.gov.in). "
        ) + (
            f"Find up to {fetch_count} actual observed prices in INR from real grounded web search results on platforms in India. "
            f"Reply in plain research notes, one listing at a time, with its title, observed price, marketplace, "
            f"and why it visually matches. Do not make up a price, product, or URL; omit a listing if the "
            f"grounded source does not show enough evidence."
        )

        content_parts: List[Dict[str, Any]] = [{"text": research_prompt}]
        if image_url:
            # Reuse the catalog image preparation path so uploaded data-URI
            # photos are sent as Gemini inline vision input.
            from backend.app.services.ai_adapter import prepare_image_part
            async with httpx.AsyncClient(timeout=10.0) as image_client:
                image_part = await prepare_image_part(image_url, image_client)
            if image_part:
                content_parts.append(image_part)
            else:
                logger.warning("[Market] Craft image could not be prepared; continuing with text-only grounded search")

        # Pass 1 is deliberately plain text. Google Search Grounding metadata
        # is retained here, then a second non-search pass extracts JSON. This
        # avoids coupling structured output with the grounding tool.
        grounded_payload = {
            "contents": [{"parts": content_parts}],
            "tools": [{"google_search": {}}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 4096,
            }
        }

        for model in models_to_try:
            try:
                api_url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{model}:generateContent?key={self.api_key}"
                )
                async with httpx.AsyncClient(timeout=12.0) as client:
                    resp = await client.post(api_url, json=grounded_payload, headers={"Content-Type": "application/json"})

                if resp.status_code == 429:
                    logger.warning("[Market] Gemini model %s quota exceeded (429), trying next model", model)
                    self.last_failure_reason = (
                        "Gemini Google Search grounding quota is exhausted, so no live market lookup could run. "
                        "The Gemini model is available, but its separate Search-grounding allowance needs quota or billing."
                    )
                    continue

                if resp.status_code != 200:
                    logger.warning("[Market] Gemini model %s returned HTTP %s", model, resp.status_code)
                    self.last_failure_reason = (
                        f"Gemini Search is temporarily unavailable (HTTP {resp.status_code})."
                    )
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

                research_parts = candidate.get("content", {}).get("parts", [])
                if not isinstance(research_parts, list):
                    research_parts = []
                research_text = "".join(
                    p.get("text", "") for p in research_parts if isinstance(p, dict)
                ).strip()
                if not research_text:
                    logger.warning("[Market] Gemini %s returned no grounded research text", model)
                    continue

                # Pass 2 has no web tool. The model receives only the research
                # text and server-owned grounded source list. It must return a
                # source index, never a URL. The backend owns every final URL.
                source_manifest = [
                    {
                        "source_index": index + 1,
                        "title": source["title"],
                        "domain": source["domain"],
                        "url": source["uri"],
                    }
                    for index, source in enumerate(grounded_chunks_list)
                ]
                extraction_prompt = (
                    "Convert the grounded market-research notes below into a JSON array. "
                    "Return at most {limit} objects with: source_index (integer from the supplied sources), "
                    "title, price (numeric INR or null), currency ('INR'), source, description, category, "
                    "and materials (string array). Never output a URL. Only retain an observed price that "
                    "appears in the research notes. If a fact is uncertain, omit that listing.\n\n"
                    "Grounded sources (server-owned):\n{sources}\n\n"
                    "Research notes:\n{research}"
                ).format(
                    limit=fetch_count,
                    sources=json.dumps(source_manifest, ensure_ascii=False),
                    research=research_text,
                )
                extraction_payload = {
                    "contents": [{"parts": [{"text": extraction_prompt}]}],
                    "generationConfig": {
                        "temperature": 0.0,
                        "maxOutputTokens": 4096,
                        "responseMimeType": "application/json",
                    },
                }
                async with httpx.AsyncClient(timeout=12.0) as client:
                    extraction_resp = await client.post(
                        api_url, json=extraction_payload, headers={"Content-Type": "application/json"}
                    )
                if extraction_resp.status_code != 200:
                    logger.warning(
                        "[Market] Gemini extraction pass on %s returned HTTP %s",
                        model, extraction_resp.status_code,
                    )
                    self.last_failure_reason = "Gemini could not structure the grounded market research."
                    continue
                extraction_candidates = extraction_resp.json().get("candidates") or []
                extraction_candidate = extraction_candidates[0] if extraction_candidates else {}
                extraction_parts = extraction_candidate.get("content", {}).get("parts", []) if isinstance(extraction_candidate, dict) else []
                extraction_text = "".join(
                    p.get("text", "") for p in extraction_parts if isinstance(p, dict)
                )
                parsed_array = _extract_json_array(extraction_text)
                if not parsed_array:
                    logger.warning("[Market] Gemini %s could not parse extraction JSON: %s", model, extraction_text[:200])
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
                    source_index = item.get("source_index")
                    try:
                        source_index = int(source_index)
                    except (TypeError, ValueError):
                        # Compatibility for older responses: order maps to the
                        # server-owned source manifest, never to a model URL.
                        source_index = idx + 1
                    if source_index < 1 or source_index > len(grounded_chunks_list):
                        logger.info("[Market] Rejecting listing '%s' - invalid grounded source index", title)
                        continue
                    grounded_source = grounded_chunks_list[source_index - 1]
                    final_url = grounded_source["uri"]
                    if source == "Web Search":
                        source = grounded_source["domain"] or source

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
                self.last_failure_reason = "Gemini Search could not be reached. Please try again shortly."

        logger.warning("[Market] All Gemini models exhausted or ungrounded for query '%s'", clean_q)
        return []


def _extract_regex_price(text: str) -> Optional[float]:
    """
    Extracts price from text via regex supporting INR, Rs, USD ($), and trailing currency words.
    Converts USD to INR at standard 83.0 conversion rate.
    """
    if not text:
        return None
    inr_match = re.search(r'(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{2})?)', text, re.IGNORECASE)
    if inr_match:
        try:
            val = float(inr_match.group(1).replace(",", ""))
            if val > 0:
                return round(val, 2)
        except ValueError:
            pass

    usd_match = re.search(r'(?:\$|USD)\s*([\d,]+(?:\.\d{2})?)', text, re.IGNORECASE)
    if usd_match:
        try:
            val_usd = float(usd_match.group(1).replace(",", ""))
            if val_usd > 0:
                return round(val_usd * 83.0, 2)
        except ValueError:
            pass

    trailing_match = re.search(r'([\d,]+(?:\.\d{2})?)\s*(?:rupees|rs|inr)\b', text, re.IGNORECASE)
    if trailing_match:
        try:
            val = float(trailing_match.group(1).replace(",", ""))
            if val > 0:
                return round(val, 2)
        except ValueError:
            pass

    return None


def _verify_price_in_evidence(price_val: float, price_evidence: str, title: str, snippet: str) -> bool:
    """
    Verifies that numeric price_val is explicitly supported by text evidence (title, snippet, or price_evidence).
    Rejects range prices, subscription prices, or ungrounded prices.
    """
    if price_val <= 0:
        return False

    combined_text = f"{title} {snippet} {price_evidence}".lower()

    # Reject subscription/recurring indicators if ambiguous
    ambiguous_patterns = [
        r"\bper\s+month\b", r"\b/mo\b", r"\bper\s+year\b", r"\bstarting\s+at\b", r"\bstarts\s+at\b", r"\bup\s+to\b"
    ]
    for pat in ambiguous_patterns:
        if re.search(pat, combined_text):
            logger.info("[Market Verify] Rejecting price %.2f due to ambiguous phrase '%s'", price_val, pat)
            return False

    int_price = int(round(price_val))
    str_price_plain = str(int_price)
    str_price_commas = f"{int_price:,}"

    if str_price_plain in combined_text or str_price_commas in combined_text:
        return True

    return False


class SearXNGMarketResearchProvider(BaseMarketResearchProvider):
    """
    Self-Hosted Free SearXNG Market Research Provider.
    Queries a SearXNG instance for real search results, uses Gemini Flash for structured JSON extraction,
    and enforces a strict verification layer (URL proof & snippet price evidence).
    Does not automatically failover to WEB_SEARCH (Gemini Grounding) to avoid unexpected 429 quota errors.
    """

    def __init__(self, searxng_url: Optional[str] = None, api_key: Optional[str] = None):
        if not searxng_url:
            try:
                from backend.app.config import SEARXNG_BASE_URL
                searxng_url = SEARXNG_BASE_URL
            except Exception:
                searxng_url = os.getenv("SEARXNG_BASE_URL", "http://localhost:8080")
        self.searxng_url = (searxng_url or "http://localhost:8080").rstrip("/")

        if not api_key:
            try:
                from backend.app.config import GEMINI_API_KEY
                api_key = GEMINI_API_KEY
            except Exception:
                pass
        self.api_key = (api_key or os.getenv("GEMINI_API_KEY", "")).strip()
        self.last_failure_reason: Optional[str] = None

    async def search_comparable_products(
        self, query: str, limit: int = 10, image_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        self.last_failure_reason = None
        if not query or not query.strip():
            return []

        clean_q = query.strip()
        cached_res = get_market_cache(clean_q, image_url)
        if cached_res is not None:
            return cached_res[:limit]

        # Step 1: Query SearXNG JSON API
        searxng_endpoint = f"{self.searxng_url}/search"
        params = {
            "q": clean_q,
            "format": "json",
            "categories": "general",
            "language": "en-IN"
        }

        searxng_results = []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(searxng_endpoint, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict) and "results" in data and isinstance(data["results"], list):
                        searxng_results = data["results"]
                else:
                    logger.warning("[SearXNG] SearXNG returned HTTP %s", resp.status_code)
                    self.last_failure_reason = f"SearXNG service returned HTTP {resp.status_code}."
        except Exception as err:
            logger.warning("[SearXNG] Could not connect to SearXNG at %s: %s", self.searxng_url, err)
            self.last_failure_reason = f"Could not connect to SearXNG search engine at {self.searxng_url}."

        if not searxng_results:
            if not self.last_failure_reason:
                self.last_failure_reason = "SearXNG search returned 0 results."
            logger.warning("[SearXNG] No results for query '%s'", clean_q)
            return []

        # Prepare source manifest from SearXNG search results
        sources = []
        for idx, item in enumerate(searxng_results[:15]):
            if not isinstance(item, dict):
                continue
            url = str(item.get("url") or "").strip()
            title = str(item.get("title") or "").strip()
            content = str(item.get("content") or item.get("snippet") or "").strip()
            if url.startswith("http://") or url.startswith("https://"):
                sources.append({
                    "source_index": len(sources) + 1,
                    "url": url,
                    "title": title,
                    "snippet": content,
                    "domain": urlparse(url).netloc.lower()
                })

        if not sources:
            self.last_failure_reason = "No valid web source URLs found in SearXNG results."
            return []

        if not self.api_key:
            try:
                from backend.app.config import GEMINI_API_KEY
                self.api_key = GEMINI_API_KEY.strip()
            except Exception:
                pass

        if not self.api_key:
            # Basic regex extraction if no Gemini key available
            results = []
            for s in sources[:limit]:
                price_val = _extract_regex_price(f"{s['title']} {s['snippet']}")
                if price_val and not _verify_price_in_evidence(price_val, "", s["title"], s["snippet"]):
                    price_val = None
                results.append({
                    "title": s["title"],
                    "price": price_val,
                    "currency": "INR",
                    "source": s["domain"],
                    "url": s["url"],
                    "description": s["snippet"][:200],
                    "category": clean_q,
                    "materials": [],
                    "observed_at": datetime.now(timezone.utc)
                })
            set_market_cache(clean_q, results, image_url)
            return results[:limit]

        # Step 2: Use Gemini Flash for structured extraction
        from backend.app.config import GEMINI_MODEL, GEMINI_FALLBACK_MODELS
        models_to_try = [GEMINI_MODEL] + [m for m in GEMINI_FALLBACK_MODELS if m != GEMINI_MODEL]

        extraction_prompt = (
            f"You are an expert market analyst extracting product pricing for handmade/artisan items in India. "
            f"Analyze these real web search results from SearXNG for query: \"{clean_q}\".\n"
            f"Prioritize authentic Indian artisan marketplaces and ONDC channels like India Handmade (indiahandmade.com), Mystore (mystore.in), iTokri, Jaypore, Tribes India, Craftsvilla.\n\n"
            f"SearXNG Search Results:\n{json.dumps(sources, ensure_ascii=False, indent=2)}\n\n"
            f"Return a JSON array of up to {min(limit, len(sources))} objects. Each object MUST include:\n"
            f"- source_index (integer matching source_index above)\n"
            f"- title (string)\n"
            f"- price_evidence (string, exact price mention from snippet/title e.g. \"₹1,499\", or null if not explicitly mentioned)\n"
            f"- price (numeric INR or null)\n"
            f"- currency ('INR')\n"
            f"- description (string)\n"
            f"- category (string)\n"
            f"- materials (list of strings)\n"
            f"Do not invent a price or mock products. If the snippet does not show an explicit price, set price and price_evidence to null."
        )

        extraction_payload = {
            "contents": [{"parts": [{"text": extraction_prompt}]}],
            "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": 4096,
                "responseMimeType": "application/json",
            },
        }

        results = []
        for model in models_to_try:
            try:
                api_url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{model}:generateContent?key={self.api_key}"
                )
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.post(api_url, json=extraction_payload, headers={"Content-Type": "application/json"})

                if resp.status_code != 200:
                    logger.warning("[SearXNG] Gemini extraction pass on %s returned HTTP %s", model, resp.status_code)
                    continue

                res_json = resp.json()
                candidates = res_json.get("candidates") or []
                if not candidates:
                    continue

                parts = candidates[0].get("content", {}).get("parts", []) if isinstance(candidates[0], dict) else []
                extraction_text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
                parsed_array = _extract_json_array(extraction_text)
                if not parsed_array:
                    continue

                # Step 3: Verification Layer
                for item in parsed_array:
                    if not isinstance(item, dict):
                        continue
                    title = str(item.get("title") or "").strip()
                    if not title:
                        continue

                    # 3a. URL Verification (must come from SearXNG source list)
                    s_idx = item.get("source_index")
                    try:
                        s_idx = int(s_idx)
                    except (TypeError, ValueError):
                        continue
                    if s_idx < 1 or s_idx > len(sources):
                        continue
                    matched_source = sources[s_idx - 1]
                    final_url = matched_source["url"]

                    # 3b. Price Evidence Verification
                    raw_price = item.get("price")
                    price_evidence = str(item.get("price_evidence") or "").strip()
                    parsed_price = None

                    if raw_price is not None:
                        try:
                            p_val = float(str(raw_price).replace(",", "").replace("₹", "").strip())
                            if p_val > 0:
                                if _verify_price_in_evidence(p_val, price_evidence, matched_source["title"], matched_source["snippet"]):
                                    parsed_price = p_val
                                else:
                                    logger.info("[SearXNG] Unverified price %s for '%s' (not in snippet text)", p_val, title)
                        except (ValueError, TypeError):
                            pass

                    results.append({
                        "title": title,
                        "price": parsed_price,
                        "currency": "INR",
                        "source": matched_source["domain"],
                        "url": final_url,
                        "description": str(item.get("description") or matched_source["snippet"]),
                        "category": str(item.get("category") or clean_q),
                        "materials": item.get("materials") or [],
                        "observed_at": datetime.now(timezone.utc)
                    })

                if results:
                    logger.info("[SearXNG] Successfully extracted %d verified comparables for '%s'", len(results), clean_q)
                    set_market_cache(clean_q, results, image_url)
                    return results[:limit]

            except Exception as err:
                logger.warning("[SearXNG] Gemini request error on %s: %s", model, err)

        # Basic fallback regex if LLM pass yielded no valid items
        if not results and sources:
            for s in sources[:limit]:
                price_val = _extract_regex_price(f"{s['title']} {s['snippet']}")
                if price_val and not _verify_price_in_evidence(price_val, "", s["title"], s["snippet"]):
                    price_val = None
                results.append({
                    "title": s["title"],
                    "price": price_val,
                    "currency": "INR",
                    "source": s["domain"],
                    "url": s["url"],
                    "description": s["snippet"][:200],
                    "category": clean_q,
                    "materials": [],
                    "observed_at": datetime.now(timezone.utc)
                })

        if results:
            set_market_cache(clean_q, results, image_url)
            return results[:limit]

        return []


class MockMarketResearchProvider(BaseMarketResearchProvider):
    def __init__(self, mock_listings=None):
        self._mock_listings = mock_listings

    async def search_comparable_products(
        self, query: str, limit: int = 10, image_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        if self._mock_listings is not None:
            results = []
            for idx, item in enumerate(self._mock_listings[:limit]):
                item_copy = dict(item)
                if "url" not in item_copy:
                    item_copy["url"] = f"https://example.com/mock/{idx+1}"
                results.append(item_copy)
            return results
        # Unit testing fixture support for test_market_research.py
        if query and "bamboo basket" in query.lower():
            return [
                {"title": "Handwoven Bamboo Basket", "price": 850.0, "currency": "INR", "source": "Unit Test Fixture", "url": "https://example.com/test-bamboo", "description": "Test fixture.", "category": query, "materials": ["Bamboo"], "observed_at": now},
            ][:limit]
        return []


WebSearchMarketResearchProvider = GeminiGroundingMarketResearchProvider


def get_default_market_research_provider() -> BaseMarketResearchProvider:
    try:
        from backend.app.config import MARKET_RESEARCH_PROVIDER
        prov_setting = MARKET_RESEARCH_PROVIDER
    except Exception:
        prov_setting = os.getenv("MARKET_RESEARCH_PROVIDER", "SEARXNG").strip().upper()

    if prov_setting == "SEARXNG":
        return SearXNGMarketResearchProvider()
    if prov_setting == "MOCK":
        return MockMarketResearchProvider()
    if prov_setting == "NOOP":
        return NoOpMarketResearchProvider()
    return GeminiGroundingMarketResearchProvider()

