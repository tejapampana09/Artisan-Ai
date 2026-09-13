import asyncio
import concurrent.futures
from decimal import Decimal
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from backend.app.schemas import ArtisanFacts, MarketResearchResponse, MarketSummary
from backend.app.services.ai_adapter import generate_catalog_draft, extract_artisan_facts
from backend.app.services.catalog_validator import validate_catalog_draft, has_verified_artisan_input
from backend.app.services.market_research import research_market
from backend.app.services.market_research_provider import BaseMarketResearchProvider
from backend.app.services.pricing_engine import calculate_price_recommendation_from_inputs

def _run_coro_sync(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop is not None and loop.is_running():
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return pool.submit(lambda: asyncio.run(coro)).result()
    else:
        return asyncio.run(coro)

async def process_full_catalog_pipeline(
    artisan_facts: Optional[ArtisanFacts] = None,
    voice_description: str = "",
    language: str = "en",
    image_url: Optional[str] = None,
    category_hint: Optional[str] = None,
    material_cost: Optional[float] = None,
    labour_cost: Optional[float] = None,
    packaging_cost: Optional[float] = None,
    other_cost: Optional[float] = None,
    selling_price: Optional[float] = None,
    qna_answers: Optional[Dict[str, str]] = None,
    provider: Optional[BaseMarketResearchProvider] = None,
    db: Optional[Session] = None,
    user_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Unified Catalog Orchestrator:
    1. Extracts canonical ArtisanFacts 🔒.
    2. Generates Gemini catalog draft.
    3. Validates catalog draft against canonical ArtisanFacts.
    4. Performs Market Research for comparable listings.
    5. Calculates market-aware price recommendation using pure pricing helper.
    6. Returns complete unified response payload.
    """
    # 1. Canonical ArtisanFacts extraction 🔒
    canonical_facts = extract_artisan_facts(
        artisan_facts=artisan_facts,
        qna_answers=qna_answers,
        voice_description=voice_description,
        category_hint=category_hint
    )

    has_user_input = has_verified_artisan_input(
        artisan_facts=artisan_facts,
        qna_answers=qna_answers,
        voice_description=voice_description,
        category_hint=category_hint
    )

    # 2 & 3. Concurrently generate Gemini catalog draft AND market research when artisan input is present
    if has_user_input:
        draft_coro = generate_catalog_draft(
            artisan_facts=canonical_facts,
            voice_description=voice_description,
            language=language,
            image_url=image_url,
            category_hint=category_hint,
            material_cost=material_cost,
            labour_cost=labour_cost,
            packaging_cost=packaging_cost,
            other_cost=other_cost,
            qna_answers=qna_answers
        )
        market_coro = research_market(
            artisan_facts=canonical_facts,
            provider=provider,
            title_hint=canonical_facts.product_name or category_hint,
            category_hint=canonical_facts.craft_type or category_hint
        )
        raw_draft, market_response = await asyncio.gather(draft_coro, market_coro)
        validated_catalog = validate_catalog_draft(
            raw_draft,
            canonical_facts,
            allow_ai_visual_inference=False
        )
    else:
        # Sequential: visual inference needed to derive product title for market research
        raw_draft = await generate_catalog_draft(
            artisan_facts=canonical_facts,
            voice_description=voice_description,
            language=language,
            image_url=image_url,
            category_hint=category_hint,
            material_cost=material_cost,
            labour_cost=labour_cost,
            packaging_cost=packaging_cost,
            other_cost=other_cost,
            qna_answers=qna_answers
        )
        validated_catalog = validate_catalog_draft(
            raw_draft,
            canonical_facts,
            allow_ai_visual_inference=True
        )
        market_response = await research_market(
            artisan_facts=canonical_facts,
            provider=provider,
            title_hint=validated_catalog.get("title") or validated_catalog.get("title_en"),
            category_hint=validated_catalog.get("category") or category_hint
        )

    raw_market_median = market_response.summary.median_price if market_response.summary else None
    market_currency = market_response.summary.currency if market_response.summary else "INR"
    market_is_reliable = market_response.summary.is_reliable if market_response.summary else False

    # 5. Pure Market-Aware Pricing Calculation (No DB Product required)
    pricing_rec = calculate_price_recommendation_from_inputs(
        title=validated_catalog.get("title", ""),
        category=validated_catalog.get("category", "Handcrafted"),
        current_price=selling_price or 0.0,
        material_cost=material_cost or 0.0,
        labour_cost=labour_cost or 0.0,
        packaging_cost=packaging_cost or 0.0,
        other_cost=other_cost or 0.0,
        min_margin_pct=0.20,
        market_median=raw_market_median,
        market_currency=market_currency,
        market_is_reliable=market_is_reliable,
        product_currency="INR"
    )

    # Clean catalog payload structure
    catalog_fields = {
        "title": validated_catalog.get("title", ""),
        "category": validated_catalog.get("category", ""),
        "materials": validated_catalog.get("materials", ""),
        "description": validated_catalog.get("description", ""),
        "craft_story": validated_catalog.get("craft_story", ""),
        "title_en": validated_catalog.get("title_en"),
        "description_en": validated_catalog.get("description_en"),
        "craft_story_en": validated_catalog.get("craft_story_en"),
        "translations": validated_catalog.get("translations"),
        "tags": validated_catalog.get("tags", []),
        "image_url": validated_catalog.get("image_url", ""),
        "enhanced_image_url": validated_catalog.get("enhanced_image_url", ""),
        "ai_inferred_fields": validated_catalog.get("ai_inferred_fields", [])
    }

    market_summary_dict = market_response.summary.model_dump() if market_response.summary else {
        "comparable_count": 0,
        "min_price": None,
        "median_price": None,
        "max_price": None,
        "currency": "INR"
    }

    min_fair = Decimal(str(pricing_rec["minimum_fair_price"])) if (pricing_rec.get("minimum_fair_price") and pricing_rec["minimum_fair_price"] > 0) else None
    rec_price = Decimal(str(pricing_rec["recommended_price"])) if (pricing_rec.get("recommended_price") is not None and pricing_rec["recommended_price"] > 0) else None
    pricing_available = (rec_price is not None and float(rec_price) > 0) or (raw_market_median is not None and float(raw_market_median) > 0)
    pricing_source = pricing_rec.get("safety_constraints", {}).get("pricing_case", "MARKET_BASED_RECOMMENDATION")
    notice_text = None

    import json
    import uuid
    from backend.app.models import DraftCatalog

    draft_token = f"draft_{uuid.uuid4().hex[:16]}"

    if db is not None:
        try:
            draft_rec = DraftCatalog(
                draft_token=draft_token,
                user_id=user_id,
                artisan_facts_json=json.dumps(canonical_facts.model_dump()),
                catalog_draft_json=json.dumps(catalog_fields),
                market_summary_json=json.dumps(market_summary_dict),
                price_recommendation_json=json.dumps(pricing_rec),
                material_cost=Decimal(str(material_cost or 0.0)),
                labour_cost=Decimal(str(labour_cost or 0.0)),
                packaging_cost=Decimal(str(packaging_cost or 0.0)),
                other_cost=Decimal(str(other_cost or 0.0)),
                min_margin_pct=Decimal("0.20")
            )
            db.add(draft_rec)
            db.commit()
        except Exception:
            db.rollback()
            raise

    return {
        "draft_token": draft_token,
        "source": validated_catalog.get("source", "MANUAL_DRAFT"),
        "is_live_ai": validated_catalog.get("is_live_ai", False),
        "is_demo_data": False,
        "requires_artisan_verification": True,
        # Flat backward compatibility fields
        "title": catalog_fields["title"],
        "category": catalog_fields["category"],
        "materials": catalog_fields["materials"],
        "description": catalog_fields["description"],
        "craft_story": catalog_fields["craft_story"],
        "title_en": catalog_fields["title_en"],
        "description_en": catalog_fields["description_en"],
        "craft_story_en": catalog_fields["craft_story_en"],
        "translations": catalog_fields["translations"],
        "tags": catalog_fields["tags"],
        "suggested_price": rec_price,
        "min_fair_price": min_fair,
        "material_cost": Decimal(str(material_cost)) if material_cost is not None else None,
        "labour_cost": Decimal(str(labour_cost)) if labour_cost is not None else None,
        "packaging_cost": Decimal(str(packaging_cost)) if packaging_cost is not None else None,
        "other_cost": Decimal(str(other_cost)) if other_cost is not None else None,
        "min_margin_pct": Decimal("0.20"),
        "pricing_available": pricing_available,
        "pricing_source": pricing_source,
        "image_url": catalog_fields["image_url"],
        "enhanced_image_url": catalog_fields["enhanced_image_url"],
        "transcription": voice_description,
        "language_detected": language,
        "lifecycle_state": "AI_GENERATED",
        "ai_inferred_fields": catalog_fields["ai_inferred_fields"],
        "notice": validated_catalog.get("notice") or notice_text,
        # Phase 7 Unified Contract
        "catalog": catalog_fields,
        "artisan_facts": canonical_facts.model_dump(),
        "market_summary": market_summary_dict,
        "market_research": market_response.model_dump(),
        "price_recommendation": pricing_rec
    }

def process_full_catalog_pipeline_sync(*args, **kwargs) -> Dict[str, Any]:
    return _run_coro_sync(process_full_catalog_pipeline(*args, **kwargs))
