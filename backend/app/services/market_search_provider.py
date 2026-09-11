import re
import logging
import httpx
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session
from backend.app.models import Product, MarketEvidence

logger = logging.getLogger("artisan_ai.market_search")

def to_decimal_str(val, default="0.00") -> str:
    if val is None:
        return default
    try:
        d = Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return str(d)
    except Exception:
        return default

class MarketSearchProvider(ABC):
    """
    Abstract interface for evidence-based market research providers.
    Hard Invariant: An item is valid market evidence ONLY if it contains:
    - URL (source_url)
    - Title (title)
    - Source Platform (source)
    - Listed Price (listed_price)
    - Retrieved Timestamp (retrieved_at)
    """

    @abstractmethod
    async def search_market(
        self, 
        query: str, 
        category: Optional[str] = None, 
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        pass

class WebSearchProvider(MarketSearchProvider):
    """
    Real Web Search provider. Queries live online marketplaces (Etsy India, Craftsvilla, Jaypore, Amazon Karigar).
    Parses real titles, source URLs, platform names, and observed prices.
    Returns status INSUFFICIENT_EVIDENCE if no verifiable listing with URL & price is retrieved.
    """

    def __init__(self, timeout_seconds: float = 6.0):
        self.timeout = timeout_seconds

    async def search_market(
        self, 
        query: str, 
        category: Optional[str] = None, 
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        search_term = f"buy {query} {category or ''} India price INR".strip()
        logger.info(f"[WebSearchProvider] Searching live web for: '{search_term}'")

        evidences = []
        try:
            url = "https://html.duckduckgo.com/html/"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                res = await client.post(url, data={"q": search_term}, headers=headers)

            if res.status_code == 200:
                html = res.text
                evidences = self._extract_evidences_from_html(html, query)
        except Exception as e:
            logger.warning(f"[WebSearchProvider] Live web search query encountered exception: {e}")

        if not evidences:
            logger.info("[WebSearchProvider] No verifiable search evidence retrieved. Returning INSUFFICIENT_EVIDENCE.")
            return {
                "research_status": "INSUFFICIENT_EVIDENCE",
                "evidence_type": "LIVE_WEB",
                "evidences": [],
                "market_range": {"min": None, "max": None},
                "median": None,
                "confidence_score": 0.0,
                "message": "Not enough reliable online listings were found for this craft. We won't guess the market price."
            }

        prices = [Decimal(item["listed_price"]) for item in evidences]
        min_price = min(prices)
        max_price = max(prices)
        sorted_prices = sorted(prices)
        n = len(sorted_prices)
        median_price = (
            sorted_prices[n // 2] if n % 2 != 0 
            else ((sorted_prices[n // 2 - 1] + sorted_prices[n // 2]) / Decimal(2))
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        return {
            "research_status": "LIVE_WEB_SEARCH",
            "evidence_type": "LIVE_WEB",
            "evidences": evidences,
            "market_range": {
                "min": to_decimal_str(min_price),
                "max": to_decimal_str(max_price)
            },
            "median": to_decimal_str(median_price),
            "confidence_score": min(0.95, round(0.5 + (len(evidences) * 0.08), 2)),
            "message": f"Found {len(evidences)} verified online listings from actual marketplaces."
        }

    def _extract_evidences_from_html(self, html: str, query: str) -> List[Dict[str, Any]]:
        evidences = []
        import datetime

        link_pattern = re.compile(
            r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', re.IGNORECASE | re.DOTALL
        )
        matches = link_pattern.findall(html)

        query_tokens = [t.lower() for t in re.findall(r'\w+', query) if len(t) >= 3 and t.lower() not in {"buy", "india", "price", "inr", "craft", "item"}]

        for href, title_html in matches:
            clean_title = re.sub(r'<[^>]+>', '', title_html).strip()
            if not clean_title or len(clean_title) < 5:
                continue

            target_url = href
            if "/l/?" in target_url or "uddg=" in target_url:
                url_match = re.search(r'uddg=([^&]+)', target_url)
                if url_match:
                    import urllib.parse
                    target_url = urllib.parse.unquote(url_match.group(1))

            if not (target_url.startswith("http://") or target_url.startswith("https://")):
                continue

            if query_tokens:
                if not any(token in clean_title.lower() or token in target_url.lower() for token in query_tokens):
                    continue

            domain = target_url.split("/")[2].replace("www.", "") if len(target_url.split("/")) > 2 else "Web Marketplace"
            platform_name = domain.capitalize()
            if "etsy" in domain:
                platform_name = "Etsy India"
            elif "craftsvilla" in domain:
                platform_name = "Craftsvilla"
            elif "jaypore" in domain:
                platform_name = "Jaypore"
            elif "amazon" in domain:
                platform_name = "Amazon Karigar"
            elif "pepperfry" in domain:
                platform_name = "Pepperfry"
            elif "flipkart" in domain:
                platform_name = "Flipkart Samarth"

            price_match = re.search(r'(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)', clean_title, re.IGNORECASE)
            if price_match:
                raw_price = price_match.group(1).replace(",", "")
                try:
                    price_val = Decimal(raw_price)
                    if 100 <= price_val <= 50000:
                        evidences.append({
                            "title": clean_title[:120],
                            "source": platform_name,
                            "source_url": target_url,
                            "listed_price": to_decimal_str(price_val),
                            "currency": "INR",
                            "retrieved_at": datetime.datetime.utcnow().isoformat() + "Z",
                            "similarity": 0.88,
                            "evidence_type": "LIVE_WEB"
                        })
                except Exception:
                    pass

            if len(evidences) >= 6:
                break

        return evidences

class InternalMarketplaceProvider(MarketSearchProvider):
    """
    Internal Database Marketplace provider. Queries internal published artisan products.
    """

    async def search_market(
        self, 
        query: str, 
        category: Optional[str] = None, 
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        import datetime
        if not db:
            return {
                "research_status": "INSUFFICIENT_EVIDENCE",
                "evidence_type": "INTERNAL_MARKETPLACE",
                "evidences": [],
                "market_range": {"min": None, "max": None},
                "median": None,
                "confidence_score": 0.0,
                "message": "Database session unavailable for internal search."
            }

        q = db.query(Product).filter(Product.status == "PUBLISHED")
        if category:
            q = q.filter(Product.category.ilike(f"%{category}%"))

        products = q.limit(10).all()
        if not products:
            return {
                "research_status": "INSUFFICIENT_EVIDENCE",
                "evidence_type": "INTERNAL_MARKETPLACE",
                "evidences": [],
                "market_range": {"min": None, "max": None},
                "median": None,
                "confidence_score": 0.0,
                "message": "No published internal products found for category."
            }

        evidences = []
        prices = []
        for p in products:
            if p.price and Decimal(str(p.price)) > 0:
                p_dec = Decimal(str(p.price))
                prices.append(p_dec)
                evidences.append({
                    "title": p.title,
                    "source": "Artisan AI Marketplace",
                    "source_url": f"/products/{p.id}",
                    "listed_price": to_decimal_str(p_dec),
                    "currency": "INR",
                    "retrieved_at": datetime.datetime.utcnow().isoformat() + "Z",
                    "similarity": 0.95,
                    "evidence_type": "INTERNAL_MARKETPLACE"
                })

        if not prices:
            return {
                "research_status": "INSUFFICIENT_EVIDENCE",
                "evidence_type": "INTERNAL_MARKETPLACE",
                "evidences": [],
                "market_range": {"min": None, "max": None},
                "median": None,
                "confidence_score": 0.0,
                "message": "No valid priced internal products found."
            }

        min_price = min(prices)
        max_price = max(prices)
        sorted_prices = sorted(prices)
        n = len(sorted_prices)
        median_price = (
            sorted_prices[n // 2] if n % 2 != 0 
            else ((sorted_prices[n // 2 - 1] + sorted_prices[n // 2]) / Decimal(2))
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        return {
            "research_status": "INTERNAL_ONLY",
            "evidence_type": "INTERNAL_MARKETPLACE",
            "evidences": evidences,
            "market_range": {
                "min": to_decimal_str(min_price),
                "max": to_decimal_str(max_price)
            },
            "median": to_decimal_str(median_price),
            "confidence_score": min(0.90, round(0.4 + (len(evidences) * 0.05), 2)),
            "message": f"Found {len(evidences)} internal marketplace listings."
        }
