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
from backend.app.services.ml_demand_engine import MLDemandEngine

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

    GENERIC_TITLES = {
        "handcrafted heritage piece",
        "heritage piece",
        "handcrafted piece",
        "handicraft piece",
        "artisan product",
        "handcrafted item",
        "handicraft",
        "handicrafts",
        "heritage handicrafts",
        "indian handicraft items",
        "handicraft items",
        "handcrafted heritage item",
        "handcrafted art",
    }
    raw_prod = (canonical_facts.product_name or "").strip().lower()
    if raw_prod in GENERIC_TITLES:
        canonical_facts.product_name = None

    raw_craft = (canonical_facts.craft_type or "").strip().lower()
    if raw_craft in {"handcrafted", "handicraft", "heritage piece", "general"}:
        canonical_facts.craft_type = None

    has_specific_product = bool(canonical_facts.product_name and canonical_facts.product_name.strip())

    has_user_input = has_verified_artisan_input(
        artisan_facts=artisan_facts,
        qna_answers=qna_answers,
        voice_description=voice_description,
        category_hint=category_hint
    )

    # 2 & 3. If a photo is uploaded but NO specific product name is known,
    # visual inference MUST run first to derive the true craft title from the photo!
    # Run concurrently ONLY when the user explicitly specified a concrete product name.
    run_concurrent = has_user_input and (not image_url or has_specific_product)

    if run_concurrent:
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
        is_native_name = any(ord(c) > 127 for c in (canonical_facts.product_name or ""))
        title_for_market = category_hint if is_native_name else (canonical_facts.product_name or category_hint)
        market_coro = research_market(
            artisan_facts=canonical_facts,
            provider=provider,
            title_hint=title_for_market,
            category_hint=canonical_facts.craft_type or category_hint,
            image_url=image_url
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
            title_hint=validated_catalog.get("title_en") or validated_catalog.get("title"),
            category_hint=validated_catalog.get("category") or category_hint,
            image_url=image_url
        )

    raw_market_median = market_response.summary.median_price if market_response.summary else None
    market_currency = market_response.summary.currency if market_response.summary else "INR"
    market_is_reliable = market_response.summary.is_reliable if market_response.summary else False

    # 5. ML Demand Engine prediction using draft inputs (no DB Product row required)
    ml_engine = MLDemandEngine()
    ml_pred = ml_engine.predict_from_inputs(
        category=validated_catalog.get("category") or category_hint,
        material_cost=float(material_cost or 0.0),
        labour_cost=float(labour_cost or 0.0),
        packaging_cost=float(packaging_cost or 0.0),
        other_cost=float(other_cost or 0.0),
        selling_price=float(selling_price or 0.0),
        db=db
    )
    ml_demand_multiplier = float(ml_pred.get("ml_demand_multiplier", 1.0))
    ml_demand_label = ml_pred.get("demand_level", "NORMAL")
    # Compute demand_pct from ML score (0-100 → 0-100 percentage proxy)
    ml_demand_score = float(ml_pred.get("predicted_demand_score", 0.0))
    ml_demand_pct = round(ml_demand_score, 1)

    cat_name = validated_catalog.get("category") or category_hint or "Handcrafted"
    benchmark_low = None
    benchmark_high = None
    db_similar_products = []

    # 1. Search database for similar published products matching craft, title, or materials
    if db is not None:
        try:
            import re
            import statistics
            from backend.app.models import Product
            from sqlalchemy import or_

            tokens = set()
            for text in [cat_name, validated_catalog.get("title_en") or "", validated_catalog.get("title") or "", validated_catalog.get("materials") or ""]:
                for tok in re.split(r'[\s&,/-]+', text):
                    tok_clean = tok.strip().lower()
                    if len(tok_clean) >= 3 and tok_clean not in ["handcrafted", "authentic", "natural", "product", "craft", "item"]:
                        tokens.add(tok_clean)

            conditions = []
            for tok in tokens:
                conditions.append(Product.category.ilike(f"%{tok}%"))
                conditions.append(Product.title.ilike(f"%{tok}%"))
                conditions.append(Product.materials.ilike(f"%{tok}%"))

            if conditions:
                matched_prods = db.query(Product).filter(
                    Product.status == "PUBLISHED",
                    or_(*conditions)
                ).all()
                if matched_prods:
                    db_similar_products = matched_prods
                    prices = [float(p.price) for p in matched_prods if p.price and float(p.price) > 0]
                    if prices:
                        benchmark_low = min(prices)
                        benchmark_high = max(prices)
                        if not raw_market_median:
                            raw_market_median = float(statistics.median(prices))
                            market_is_reliable = True
        except Exception:
            pass

    # 2. If neither web search nor DB returned market prices, dynamically query Gemini AI for fair market evaluation
    if raw_market_median is None and (benchmark_low is None or benchmark_high is None):
        try:
            from backend.app.services.ai_adapter import estimate_fair_price
            ai_eval = await estimate_fair_price(
                title=validated_catalog.get("title_en") or validated_catalog.get("title", ""),
                category=validated_catalog.get("category", "Handcrafted"),
                materials=validated_catalog.get("materials", ""),
                description=validated_catalog.get("description_en") or validated_catalog.get("description", "")
            )
            if ai_eval and ai_eval.get("suggested_price"):
                raw_market_median = float(ai_eval["suggested_price"])
                market_is_reliable = True
                benchmark_low = float(ai_eval.get("min_fair_price") or (raw_market_median * 0.75))
                benchmark_high = round(raw_market_median * 1.30, 2)
        except Exception:
            pass

    # Pure Market-Aware Pricing Calculation (No DB Product required)
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
        product_currency="INR",
        demand_factor=ml_demand_multiplier,
        demand_label=f"{ml_demand_label} DEMAND",
        demand_pct=ml_demand_pct,
        benchmark_low=benchmark_low,
        benchmark_high=benchmark_high,
        ml_info=ml_pred
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

    if market_summary_dict.get("median_price") is None and raw_market_median is not None:
        market_summary_dict["median_price"] = raw_market_median
        market_summary_dict["min_price"] = benchmark_low
        market_summary_dict["max_price"] = benchmark_high

    market_research_dict = market_response.model_dump()
    if not market_research_dict.get("results") and db_similar_products:
        market_research_dict["results"] = [
            {
                "title": p.title,
                "price": float(p.price) if p.price else None,
                "currency": "INR",
                "source": "Catalog Similar Product",
                "url": p.image_url or "",
                "description": p.description or "",
                "category": p.category or "",
                "materials": [p.materials] if p.materials else [],
                "match_tier": "GOOD"
            }
            for p in db_similar_products[:5]
        ]
        market_summary_dict["comparable_count"] = len(market_research_dict["results"])
        market_summary_dict["priced_comparable_count"] = len([p for p in db_similar_products[:5] if p.price])

    min_fair = Decimal(str(pricing_rec["minimum_fair_price"])) if (pricing_rec.get("minimum_fair_price") and pricing_rec["minimum_fair_price"] > 0) else None
    rec_price = Decimal(str(pricing_rec["recommended_price"])) if (pricing_rec.get("recommended_price") is not None and pricing_rec["recommended_price"] > 0) else None
    if (rec_price is None or rec_price <= 0) and market_is_reliable and raw_market_median is not None and float(raw_market_median) > 0:
        rec_price = Decimal(str(raw_market_median))
    pricing_available = rec_price is not None and float(rec_price) > 0
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
        "market_research": market_research_dict,
        "price_recommendation": pricing_rec,
        "ml_demand_info": {
            "model_source": ml_pred.get("model_source", "RULE_BASED_FALLBACK"),
            "predicted_demand_score": ml_pred.get("predicted_demand_score", 0.0),
            "demand_level": ml_pred.get("demand_level", "NORMAL"),
            "ml_demand_multiplier": ml_pred.get("ml_demand_multiplier", 1.0),
            "model_info": ml_pred.get("model_info", {})
        }
    }

def process_full_catalog_pipeline_sync(*args, **kwargs) -> Dict[str, Any]:
    return _run_coro_sync(process_full_catalog_pipeline(*args, **kwargs))
