import statistics
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from copy import deepcopy

from backend.app.schemas import (
    ArtisanFacts, MarketListing, MarketSummary, MarketResearchResponse
)
from backend.app.services.market_research_provider import (
    BaseMarketResearchProvider, NoOpMarketResearchProvider, get_default_market_research_provider
)
from backend.app.services.market_similarity import calculate_market_similarity

def build_market_query(
    artisan_facts: ArtisanFacts,
    title_hint: Optional[str] = None,
    category_hint: Optional[str] = None
) -> str:
    """
    Deterministically constructs a search query string from verified ArtisanFacts and catalog hints.
    """
    parts = []
    
    if artisan_facts.product_name and artisan_facts.product_name.strip():
        parts.append(artisan_facts.product_name.strip())
    elif title_hint and title_hint.strip() and title_hint.strip().lower() not in ["handmade artisan craft product.", "handmade artisan craft product", "craft"]:
        parts.append(title_hint.strip())
        
    if artisan_facts.craft_type and artisan_facts.craft_type.strip():
        parts.append(artisan_facts.craft_type.strip())
    elif category_hint and category_hint.strip():
        parts.append(category_hint.strip())
        
    if artisan_facts.materials:
        clean_mats = [m.strip() for m in artisan_facts.materials if m.strip()]
        if clean_mats:
            parts.append(" ".join(clean_mats))
            
    if artisan_facts.special_characteristics and artisan_facts.special_characteristics.strip():
        spec_words = artisan_facts.special_characteristics.strip().split()[:5]
        if spec_words:
            parts.append(" ".join(spec_words))

    q = " ".join(parts).strip()
    if not q or len(q) < 3 or q.lower() in ["handmade artisan craft product", "craft", "product"]:
        if title_hint and title_hint.strip() and title_hint.strip().lower() not in ["handmade artisan craft product.", "handmade artisan craft product", "craft"]:
            q = f"{title_hint.strip()} buy online India"
        elif category_hint and category_hint.strip():
            q = f"{category_hint.strip()} handicraft buy online India"
        else:
            q = "handicraft artisan craft buy online India"

    return q.strip()

async def research_market(
    artisan_facts: ArtisanFacts,
    provider: Optional[BaseMarketResearchProvider] = None,
    similarity_threshold: float = 0.20,
    title_hint: Optional[str] = None,
    category_hint: Optional[str] = None
) -> MarketResearchResponse:
    """
    Market Research Service for finding external comparable listings and calculating
    market price statistics without modifying ArtisanFacts or invoking pricing engine/LLMs.
    """
    # Defensive immutability guarantee for artisan_facts
    facts_copy = deepcopy(artisan_facts)
    query = build_market_query(facts_copy, title_hint=title_hint, category_hint=category_hint)

    if not query:
        return MarketResearchResponse(
            query="",
            results=[],
            summary=MarketSummary(comparable_count=0, min_price=None, median_price=None, max_price=None),
            notice="Insufficient artisan facts provided to construct a market search query."
        )

    active_provider = provider if provider is not None else get_default_market_research_provider()
    raw_listings = await active_provider.search_comparable_products(query, limit=20)

    retained_listings: List[MarketListing] = []
    seen_identifiers = set()

    for item in raw_listings:
        title = (item.get("title") or "").strip()
        if not title:
            continue

        # Deduplication check by URL or Title
        dedup_key = (item.get("url") or title).lower()
        if dedup_key in seen_identifiers:
            continue
        seen_identifiers.add(dedup_key)

        score, flags, tier = calculate_market_similarity(facts_copy, item)
        if score < similarity_threshold:
            continue

        raw_price = item.get("price")
        parsed_price: Optional[float] = None
        if raw_price is not None:
            try:
                p_val = float(raw_price)
                if p_val > 0:
                    parsed_price = round(p_val, 2)
            except (ValueError, TypeError):
                parsed_price = None

        raw_mats = item.get("materials", [])
        if isinstance(raw_mats, list):
            clean_mats = [str(m).strip() for m in raw_mats if str(m).strip()]
        elif isinstance(raw_mats, str) and raw_mats.strip():
            clean_mats = [m.strip() for m in raw_mats.split(",") if m.strip()]
        else:
            clean_mats = []

        obs_at = item.get("observed_at")
        if obs_at is not None and not isinstance(obs_at, datetime):
            obs_at = datetime.now(timezone.utc)
        elif obs_at is None:
            obs_at = datetime.now(timezone.utc)

        listing_model = MarketListing(
            title=title,
            price=parsed_price,
            currency=str(item.get("currency") or "INR"),
            source=str(item.get("source") or "ExternalMarket"),
            url=item.get("url"),
            description=item.get("description"),
            category=item.get("category"),
            materials=clean_mats,
            matched_product=flags["matched_product"],
            matched_material=flags["matched_material"],
            matched_craft=flags["matched_craft"],
            similarity_score=score,
            match_tier=tier,
            observed_at=obs_at
        )
        retained_listings.append(listing_model)

    # Calculate Market Summary statistics on valid positive prices ONLY
    total_comparable_count = len(retained_listings)
    priced_listings = [l for l in retained_listings if l.price is not None and l.price > 0]
    valid_prices = [l.price for l in priced_listings if l.price is not None]

    summary_currency = priced_listings[0].currency if priced_listings else (retained_listings[0].currency if retained_listings else "INR")

    if valid_prices:
        min_p = round(min(valid_prices), 2)
        med_p = round(float(statistics.median(valid_prices)), 2)
        max_p = round(max(valid_prices), 2)
        priced_count = len(valid_prices)
    else:
        min_p = None
        med_p = None
        max_p = None
        priced_count = 0

    summary = MarketSummary(
        comparable_count=total_comparable_count,
        priced_comparable_count=priced_count,
        min_price=min_p,
        median_price=med_p,
        max_price=max_p,
        currency=summary_currency
    )

    notice = None
    if isinstance(active_provider, NoOpMarketResearchProvider):
        notice = "No live external search provider is currently configured. Configure a market provider to fetch external listings."
    elif not retained_listings:
        notice = f"No comparable market listings found for query '{query}' above similarity threshold."

    return MarketResearchResponse(
        query=query,
        results=retained_listings,
        summary=summary,
        notice=notice
    )
