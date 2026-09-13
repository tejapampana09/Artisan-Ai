import asyncio
import concurrent.futures
import re
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from backend.app.models import Product, PricingDecision
from backend.app.schemas import ArtisanFacts, MarketResearchResponse
from backend.app.services.market_research_provider import BaseMarketResearchProvider
from backend.app.services.market_research import research_market
from backend.app.services.pricing_engine import (
    calculate_price_recommendation,
    process_auto_smart_pricing
)

def extract_product_artisan_facts(product: Product) -> ArtisanFacts:
    """
    Extracts verified ArtisanFacts from a Product database model defensively
    without hallucinating unverified fields.
    """
    product_name = (getattr(product, "title", None) or "").strip()
    craft_type = (getattr(product, "category", None) or "").strip()

    raw_materials = getattr(product, "materials", None)
    materials_list: List[str] = []
    if isinstance(raw_materials, list):
        materials_list = [str(m).strip() for m in raw_materials if str(m).strip()]
    elif isinstance(raw_materials, str) and raw_materials.strip():
        mats = re.split(r'[,;\n]+', raw_materials)
        materials_list = [m.strip() for m in mats if m.strip()]

    craft_story = (getattr(product, "craft_story", None) or "").strip()
    description = (getattr(product, "description", None) or "").strip()

    return ArtisanFacts(
        product_name=product_name,
        craft_type=craft_type,
        materials=materials_list,
        handmade=True,
        making_time="",
        artisan_story=craft_story,
        special_characteristics=description if description else craft_story
    )

def _run_coro_sync(coro):
    """
    Safely runs a coroutine synchronously regardless of whether an event loop is running.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop is not None and loop.is_running():
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return pool.submit(lambda: asyncio.run(coro)).result()
    else:
        return asyncio.run(coro)

async def get_market_aware_price_recommendation(
    product: Product,
    db: Session,
    provider: Optional[BaseMarketResearchProvider] = None
) -> Dict[str, Any]:
    """
    Orchestration layer (Async):
    1. Extracts ArtisanFacts from Product.
    2. Executes Phase 5 Market Research (defaults to NoOpMarketResearchProvider in production).
    3. Supplies market_median and market_currency to Phase 6 Pricing Engine.
    """
    artisan_facts = extract_product_artisan_facts(product)
    
    market_response: MarketResearchResponse = await research_market(
        artisan_facts=artisan_facts,
        provider=provider
    )

    market_median = market_response.summary.median_price if market_response.summary else None
    market_currency = market_response.summary.currency if market_response.summary else None

    return calculate_price_recommendation(
        product=product,
        db=db,
        market_median=market_median,
        market_currency=market_currency
    )

def get_market_aware_price_recommendation_sync(
    product: Product,
    db: Session,
    provider: Optional[BaseMarketResearchProvider] = None
) -> Dict[str, Any]:
    """
    Orchestration layer (Sync wrapper):
    Provides synchronous interface for get_market_aware_price_recommendation.
    """
    return _run_coro_sync(get_market_aware_price_recommendation(product, db, provider=provider))

def process_market_aware_auto_pricing(
    product: Product,
    db: Session,
    cooldown_minutes: int = 15,
    bypass_cooldown: bool = False,
    provider: Optional[BaseMarketResearchProvider] = None
) -> Optional[PricingDecision]:
    """
    Orchestration layer for Autonomous Dynamic Pricing Execution:
    1. Extracts ArtisanFacts from Product.
    2. Runs Market Research.
    3. Passes market signal to process_auto_smart_pricing.
    """
    artisan_facts = extract_product_artisan_facts(product)
    market_response: MarketResearchResponse = _run_coro_sync(
        research_market(artisan_facts=artisan_facts, provider=provider)
    )

    market_median = market_response.summary.median_price if market_response.summary else None
    market_currency = market_response.summary.currency if market_response.summary else None

    return process_auto_smart_pricing(
        product=product,
        db=db,
        cooldown_minutes=cooldown_minutes,
        bypass_cooldown=bypass_cooldown,
        market_median=market_median,
        market_currency=market_currency
    )
