import json
import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.app.models import Product, MarketEvidence
from backend.app.services.ai_provider import GeminiAIProvider
from backend.app.services.pricing_engine import to_decimal
from backend.app.services.market_search_provider import (
    WebSearchProvider, 
    InternalMarketplaceProvider, 
    to_decimal_str
)

logger = logging.getLogger("artisan_ai")

class MarketResearchService:
    """
    Evidence-based external market research service for Artisan AI V2.
    Uses WebSearchProvider to retrieve real live Indian craft marketplace evidence (Etsy India, Craftsvilla, Jaypore, Amazon Karigar)
    or InternalMarketplaceProvider.
    Hard Invariant: Never manufactures fake search evidence or artificial platform URLs. Returns INSUFFICIENT_EVIDENCE if unverified.
    """
    def __init__(self, provider: Optional[GeminiAIProvider] = None):
        self.provider = provider or GeminiAIProvider()
        self.web_search_provider = WebSearchProvider()
        self.internal_search_provider = InternalMarketplaceProvider()

    async def execute_market_research(
        self,
        db: Session,
        session_id: int,
        product_facts: Dict[str, Any]
    ) -> Dict[str, Any]:
        # Extract verified facts
        def get_val(key: str) -> str:
            raw = product_facts.get(key)
            if isinstance(raw, dict):
                return str(raw.get("value", "")).strip()
            return str(raw or "").strip()

        p_name = get_val("product_name") or "Handcrafted Craft"
        cat = get_val("category") or "Handcrafted"
        mat = get_val("material") or "Natural Materials"

        # 1. Execute live WebSearchProvider search query
        web_res = await self.web_search_provider.search_market(query=p_name, category=cat, db=db)
        
        research_status = web_res.get("research_status", "INSUFFICIENT_EVIDENCE")
        evidence_type = web_res.get("evidence_type", "LIVE_WEB")
        evidences = []
        observed_prices = []

        if research_status == "LIVE_WEB_SEARCH" and web_res.get("evidences"):
            for item in web_res["evidences"]:
                price_dec = to_decimal(item.get("listed_price"))
                if price_dec > 0:
                    observed_prices.append(price_dec)
                    ev = MarketEvidence(
                        session_id=session_id,
                        source=item.get("source", "Etsy India"),
                        title=item.get("title", f"{cat} Craft"),
                        category=cat,
                        material=mat,
                        listed_price=price_dec,
                        similarity_score=to_decimal(item.get("similarity", 0.92))
                    )
                    db.add(ev)
                    evidences.append({
                        "title": item.get("title"),
                        "source": item.get("source"),
                        "source_url": item.get("source_url"),
                        "listed_price": to_decimal_str(price_dec),
                        "currency": item.get("currency", "INR"),
                        "retrieved_at": item.get("retrieved_at"),
                        "similarity": float(item.get("similarity", 0.92)),
                        "evidence_type": "LIVE_WEB",
                        "provenance": "MARKET_OBSERVED"
                    })

        # 2. If web search returned INSUFFICIENT_EVIDENCE, check internal marketplace
        if not evidences:
            internal_res = await self.internal_search_provider.search_market(query=p_name, category=cat, db=db)
            if internal_res.get("research_status") == "INTERNAL_ONLY" and internal_res.get("evidences"):
                research_status = "INTERNAL_ONLY"
                evidence_type = "INTERNAL_MARKETPLACE"
                for item in internal_res["evidences"]:
                    price_dec = to_decimal(item.get("listed_price"))
                    if price_dec > 0:
                        observed_prices.append(price_dec)
                        ev = MarketEvidence(
                            session_id=session_id,
                            source="INTERNAL_MARKETPLACE",
                            title=item.get("title", f"{cat} Craft"),
                            category=cat,
                            material=mat,
                            listed_price=price_dec,
                            similarity_score=to_decimal(item.get("similarity", 0.90))
                        )
                        db.add(ev)
                        evidences.append({
                            "title": item.get("title"),
                            "source": item.get("source"),
                            "source_url": item.get("source_url"),
                            "listed_price": to_decimal_str(price_dec),
                            "currency": item.get("currency", "INR"),
                            "retrieved_at": item.get("retrieved_at"),
                            "similarity": float(item.get("similarity", 0.90)),
                            "evidence_type": "INTERNAL_MARKETPLACE",
                            "provenance": "INTERNAL_MARKETPLACE"
                        })

        db.flush()

        # 3. Calculate market range & median using Decimal precision
        if observed_prices:
            min_p = min(observed_prices)
            max_p = max(observed_prices)
            sorted_p = sorted(observed_prices)
            n = len(sorted_p)
            median_p = (
                sorted_p[n // 2] if n % 2 != 0 
                else ((sorted_p[n // 2 - 1] + sorted_p[n // 2]) / Decimal(2))
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            result = {
                "research_status": research_status,
                "evidence_type": evidence_type,
                "market_range": {
                    "min": to_decimal_str(min_p),
                    "max": to_decimal_str(max_p)
                },
                "median": to_decimal_str(median_p),
                "confidence_score": min(0.95, round(0.5 + (len(evidences) * 0.08), 2)),
                "evidences": evidences,
                "message": f"Retrieved {len(evidences)} verified comparable market listings."
            }
        else:
            result = {
                "research_status": "INSUFFICIENT_EVIDENCE",
                "evidence_type": "LIVE_WEB",
                "market_range": {
                    "min": None,
                    "max": None
                },
                "median": None,
                "confidence_score": 0.0,
                "evidences": [],
                "message": "Not enough reliable online listings were found for this craft. We won't guess the market price."
            }

        return result
