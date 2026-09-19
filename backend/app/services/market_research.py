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
    Deterministically constructs a clean marketplace search query string.
    """
    raw_name = (artisan_facts.product_name or "").strip()
    raw_hint = (title_hint or "").strip()

    # If product_name contains native non-Latin script (Telugu, Hindi, etc.) and an English title_hint is available,
    # prefer the English title_hint because Indian e-commerce portals index products primarily in English.
    has_non_ascii_name = any(ord(c) > 127 for c in raw_name)
    has_ascii_hint = bool(raw_hint and not any(ord(c) > 127 for c in raw_hint))

    if has_non_ascii_name and has_ascii_hint:
        base_name = raw_hint
    elif not has_non_ascii_name and raw_name:
        base_name = raw_name
    elif raw_hint:
        base_name = raw_hint
    else:
        base_name = raw_name

    # Clean up common conversational prefixes
    for prefix in ["this is an authentic", "this is a", "this is", "authentic", "handcrafted"]:
        if base_name.lower().startswith(prefix):
            base_name = base_name[len(prefix):].strip()

    words = base_name.split()
    if len(words) > 6:
        base_name = " ".join(words[:5])

    if base_name and base_name.lower() in ["handmade artisan craft product.", "handmade artisan craft product", "craft", "product"]:
        base_name = ""

    craft = (artisan_facts.craft_type or category_hint or "").strip()
    generic_categories = [
        "electronics & accessories", "electronics", "accessories", "home & living", 
        "clothing & apparel", "fashion & accessories", "jewelry & accessories",
        "handcrafted", "handmade", "artisan", "custom"
    ]
    if craft and any(g in craft.lower() for g in generic_categories):
        craft = ""

    # Ensure search query is ASCII-friendly so search engines find products with prices on Indian marketplaces
    if any(ord(c) > 127 for c in base_name):
        cat_ascii = (category_hint or "").strip()
        if cat_ascii and not any(ord(c) > 127 for c in cat_ascii) and not any(g in cat_ascii.lower() for g in generic_categories):
            base_name = cat_ascii
        else:
            ascii_tokens = [w for w in base_name.split() if not any(ord(c) > 127 for c in w)]
            if ascii_tokens:
                base_name = " ".join(ascii_tokens)
            else:
                base_name = craft or "handicraft"

    if base_name:
        if craft and craft.lower() not in base_name.lower() and len(base_name.split()) < 3:
            raw_q = f"{craft} {base_name}".strip()
        else:
            raw_q = base_name
    elif craft:
        raw_q = f"{craft} craft".strip()
    else:
        raw_q = "handicraft artisan craft"

    # Include explicit materials in the query so a Kalamkari saree is not
    # benchmarked against unrelated Kalamkari decor or accessories.
    materials = " ".join((m or "").strip() for m in artisan_facts.materials if (m or "").strip() and not any(ord(c) > 127 for c in (m or "")))
    if materials:
        raw_q = f"{raw_q} {materials}".strip()

    if "price" not in raw_q.lower():
        return f"{raw_q} handcrafted price buy online India".strip()
    return raw_q.strip()

async def research_market(
    artisan_facts: ArtisanFacts,
    provider: Optional[BaseMarketResearchProvider] = None,
    similarity_threshold: float = 0.20,
    title_hint: Optional[str] = None,
    category_hint: Optional[str] = None,
    image_url: Optional[str] = None
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
    raw_listings = await active_provider.search_comparable_products(
        query, limit=20, image_url=image_url
    )

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

        score, flags, tier = calculate_market_similarity(
            facts_copy, item, title_hint=title_hint, category_hint=category_hint
        )
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

        domain = ""
        if item.get("url"):
            try:
                from urllib.parse import urlparse
                domain = urlparse(item["url"]).netloc.lower()
            except Exception:
                domain = ""
        if not domain:
            domain = str(item.get("source") or "").lower()

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

    def _is_domestic_indian_source(listing: MarketListing) -> int:
        url = (listing.url or "").lower()
        src = (listing.source or "").lower()
        official_artisan_domains = [
            "indiahandmade", "mystore", "ondc", "tribesindia", "khadiindia",
            "craftmaestros", "itokri", "jaypore", "craftsvilla", "exclusivelane"
        ]
        if any(dom in url or dom in src for dom in official_artisan_domains):
            return 3  # Highest priority: Authentic Indian artisan & government craft portals
        indian_craft_domains = [
            ".in", "indiamart", "amazon.in", "flipkart", "meesho", "zapvi",
            "cosmoslayers", "myntra", "nykaa", "ajio", "tatacliq", "pepperfry",
            "woodenstreet", "engrave"
        ]
        if any(dom in url or dom in src for dom in indian_craft_domains):
            return 2  # High priority: domestic Indian marketplace
        if any(exp in url or exp in src for exp in ["etsy.com", "ebay.com", "amazon.com"]):
            return 0  # Lower priority: cross-border international platform (USD conversion)
        return 1  # Standard priority

    # Sort listings: Price-verified -> Domestic India source -> Similarity score
    retained_listings.sort(
        key=lambda l: (
            1 if l.price is not None and l.price > 0 else 0,
            _is_domestic_indian_source(l),
            l.similarity_score
        ),
        reverse=True
    )

    # Calculate Market Summary statistics on valid positive prices with verified source URLs ONLY
    total_comparable_count = len(retained_listings)
    
    def _is_valid_url(url_val: Optional[str]) -> bool:
        if not url_val or not isinstance(url_val, str):
            return False
        u = url_val.strip().lower()
        return u.startswith("http://") or u.startswith("https://")

    priced_listings = [
        l for l in retained_listings 
        if l.price is not None and l.price > 0 and _is_valid_url(l.url)
    ]

    # Weak matches remain visible to the artisan but must not influence the
    # benchmark when enough product/category matches are available.
    strong_priced_listings = [l for l in priced_listings if l.match_tier in ("STRONG", "GOOD")]
    benchmark_listings = strong_priced_listings if len(strong_priced_listings) >= 3 else priced_listings
    valid_prices = [l.price for l in benchmark_listings if l.price is not None]

    # Remove extreme luxury/discount outliers before computing the median.
    # This is deliberately applied only with a useful sample size.
    if len(valid_prices) >= 5:
        quartiles = statistics.quantiles(valid_prices, n=4, method="inclusive")
        lower_fence = quartiles[0] - (1.5 * (quartiles[2] - quartiles[0]))
        upper_fence = quartiles[2] + (1.5 * (quartiles[2] - quartiles[0]))
        valid_prices = [price for price in valid_prices if lower_fence <= price <= upper_fence]

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

    if priced_count >= 3:
        market_conf = "HIGH"
        is_rel = True
    elif priced_count == 2:
        market_conf = "MODERATE"
        is_rel = True
    else:
        market_conf = "LOW"
        is_rel = False

    summary = MarketSummary(
        comparable_count=total_comparable_count,
        priced_comparable_count=priced_count,
        min_price=min_p,
        median_price=med_p,
        max_price=max_p,
        currency=summary_currency,
        market_confidence=market_conf,
        is_reliable=is_rel
    )

    notice = None
    if isinstance(active_provider, NoOpMarketResearchProvider):
        notice = "No live external search provider is currently configured. Configure a market provider to fetch external listings."
    elif not retained_listings:
        provider_reason = getattr(active_provider, "last_failure_reason", None)
        if provider_reason:
            notice = provider_reason
        else:
            notice = (
                "No price-verified visual market matches were found for the uploaded craft image. "
                if image_url else "No comparable market listings found for the supplied description. "
            ) + "No market price was used."

    return MarketResearchResponse(
        query=query,
        results=retained_listings,
        summary=summary,
        notice=notice
    )
