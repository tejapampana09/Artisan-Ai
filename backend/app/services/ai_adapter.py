"""
Multimodal AI Catalog Adapter.

Primary Architectural Rules:
1. Live Gemini AI: Used when GEMINI_API_KEY is present and service succeeds.
   Factual product claims and AI suggestions are treated as editable drafts requiring
   artisan verification before publishing. Factual claims must originate from the
   artisan or be clearly marked as AI-generated drafts.
2. Production Fallback: In production (or when DEMO_MODE is False), failure of the AI provider
   strictly returns a transparent MANUAL_DRAFT using ONLY information provided by the artisan.
   Never fabricates heritage claims, geographic GI tags, raw materials, or fake selling prices.
3. Demo Isolation: Deterministic sample craft profiles are isolated in backend.app.demo.craft_profiles
   and are ONLY reachable when DEMO_MODE is explicitly True and ENVIRONMENT != 'production'.
"""

import os
import json
import httpx
from typing import Dict, Any, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP

from backend.app.config import (
    GEMINI_API_KEY, 
    AI_REQUEST_TIMEOUT_SECONDS
)

def to_decimal(val, default="0.00") -> Decimal:
    if val is None:
        return Decimal(default)
    return Decimal(str(val))

def calculate_pricing_from_costs(
    mat: Optional[Any] = None,
    lab: Optional[Any] = None,
    pkg: Optional[Any] = None
) -> Tuple[Optional[Decimal], Optional[Decimal], bool, str]:
    """
    Computes (min_fair_price, suggested_price, pricing_available, pricing_source)
    using Decimal arithmetic to prevent precision issues.
    Enforces a strict 20% minimum fair profit margin over total direct cost basis.
    Returns (None, None, False, "AWAITING_ARTISAN_INPUT") if no positive costs provided.
    """
    has_costs = any(
        c is not None and Decimal(str(c)) > 0
        for c in [mat, lab, pkg]
    )
    if not has_costs:
        return None, None, False, "AWAITING_ARTISAN_INPUT"

    m = to_decimal(mat, "0.00")
    l = to_decimal(lab, "0.00")
    p = to_decimal(pkg, "0.00")
    cost_basis = (m + l + p).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    min_fair = (cost_basis * Decimal("1.20")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    suggested = (cost_basis * Decimal("1.40")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return min_fair, suggested, True, "COST_PLUS_MARGIN"

def build_production_manual_draft(
    voice_description: str,
    language: str = "en",
    image_url: Optional[str] = None,
    category_hint: Optional[str] = None,
    material_cost: Optional[Any] = None,
    labour_cost: Optional[Any] = None,
    packaging_cost: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Constructs a 100% honest manual draft when AI is unavailable in production.
    - Zero fabrication of craft stories, GI status, materials, or fake selling prices.
    - Preserves artisan's exact words.
    - Derives title honestly from first line (up to 80 chars) or 'Craft Draft (Pending Title)'.
    - If costs are missing, pricing is left as None (pricing_available=False).
    """
    clean_desc = (voice_description or "").strip()
    clean_image = (image_url or "").strip()
    clean_cat = (category_hint or "").strip() or None

    first_line = clean_desc.split("\n")[0].strip()
    if len(first_line) > 3:
        title = first_line[:80].strip()
    elif clean_cat:
        title = f"Handcrafted {clean_cat}"
    else:
        title = "Craft Draft (Pending Title)"

    min_fair, suggested, pricing_avail, pricing_src = calculate_pricing_from_costs(
        material_cost, labour_cost, packaging_cost
    )

    mat_dec = to_decimal(material_cost) if material_cost is not None else None
    lab_dec = to_decimal(labour_cost) if labour_cost is not None else None
    pkg_dec = to_decimal(packaging_cost) if packaging_cost is not None else None

    return {
        "source": "MANUAL_DRAFT",
        "is_live_ai": False,
        "is_demo_data": False,
        "requires_artisan_verification": True,
        "title": title,
        "category": clean_cat or "Handcrafted",
        "materials": "",
        "description": clean_desc,
        "craft_story": "",
        "tags": [clean_cat] if clean_cat else [],
        "suggested_price": suggested,
        "min_fair_price": min_fair,
        "material_cost": mat_dec,
        "labour_cost": lab_dec,
        "packaging_cost": pkg_dec,
        "min_margin_pct": Decimal("0.20"),
        "pricing_available": pricing_avail,
        "pricing_source": pricing_src,
        "image_url": clean_image,
        "enhanced_image_url": clean_image,
        "transcription": clean_desc,
        "language_detected": language,
        "lifecycle_state": "MANUAL_DRAFT",
        "notice": "Live AI generation is temporarily unavailable. Your original description has been preserved as an editable manual draft. Please complete and verify details manually."
    }

async def generate_catalog_draft(
    voice_description: str,
    language: str = "en",
    image_url: Optional[str] = None,
    category_hint: Optional[str] = None,
    material_cost: Optional[Any] = None,
    labour_cost: Optional[Any] = None,
    packaging_cost: Optional[Any] = None,
    force_fallback: bool = False
) -> Dict[str, Any]:
    """
    Generates an AI Catalog Draft with strict provenance and safety boundaries:
    - LIVE_AI: Live Gemini 2.5 Flash assisted drafting with disclaimer.
    - MANUAL_DRAFT: Transparent production fallback without fabricated facts or prices.
    - DEMO_FALLBACK: Isolated deterministic sample data (only in explicit non-prod demo mode).
    """
    clean_desc = (voice_description or "").strip()
    clean_image = (image_url or "").strip()
    clean_category_hint = (category_hint or "").strip() or None

    has_user_costs = any(
        c is not None and Decimal(str(c)) > 0 
        for c in [material_cost, labour_cost, packaging_cost]
    )

    # -------------------------------------------------------------------------
    # 1. LIVE GEMINI AI PATHWAY
    # -------------------------------------------------------------------------
    if GEMINI_API_KEY and not force_fallback:
        try:
            prompt = f"""
            You are Artisan AI's cataloging assistant for traditional Indian artisans.
            The artisan provided this description: "{clean_desc}".
            Language used: {language}. Craft hint: {clean_category_hint or 'Not specified'}.
            
            Assist by structuring this into a product draft.
            IMPORTANT GUIDELINE:
            Do not invent unverified GI certifications or false claims not implied by the artisan's words.
            
            Return a valid JSON object with:
            - title: Catchy, market-ready title (max 10 words)
            - category: One of Kalamkari, Wooden Toys, Blue Pottery, Bidriware, Pochampally Ikat, Terracotta, Handloom, Other
            - materials: Comma-separated list of materials derived from description
            - description: Professional 2-3 sentence product overview
            - craft_story: Cultural or artisanal narrative based on the description
            - tags: Array of 4-6 relevant discovery strings
            - suggested_price: Fair selling price in INR as a number
            - estimated_cost: object with keys "material", "labour", "packaging" as numbers
            """
            models_to_try = [
                os.getenv("GEMINI_MODEL", "gemini-3.6-flash"),
                "gemini-3.6-flash",
                "gemini-2.0-flash",
                "gemini-1.5-flash"
            ]
            async with httpx.AsyncClient(timeout=AI_REQUEST_TIMEOUT_SECONDS) as client:
                res = None
                for model in models_to_try:
                    try:
                        resp = await client.post(
                            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}",
                            json={
                                "contents": [{"parts": [{"text": prompt}]}],
                                "generationConfig": {"response_mime_type": "application/json"}
                            },
                            headers={"Content-Type": "application/json"}
                        )
                        if resp.status_code == 200:
                            res = resp
                            break
                    except Exception:
                        continue

                if res and res.status_code == 200:
                    data = res.json()
                    content = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if content.startswith("```"):
                        lines = content.split("\n")
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].strip() == "```":
                            lines = lines[:-1]
                        content = "\n".join(lines).strip()
                    parsed = json.loads(content)

                    # Validate required core fields from AI
                    if "title" in parsed and "category" in parsed:
                        # Prioritize user costs over AI estimated costs
                        if has_user_costs:
                            min_fair, suggested, pricing_available, pricing_source = calculate_pricing_from_costs(
                                material_cost, labour_cost, packaging_cost
                            )
                            mat = to_decimal(material_cost, "0.00")
                            lab = to_decimal(labour_cost, "0.00")
                            pkg = to_decimal(packaging_cost, "0.00")
                        else:
                            est_cost = parsed.get("estimated_cost", {})
                            mat = to_decimal(est_cost.get("material"), "0.00")
                            lab = to_decimal(est_cost.get("labour"), "0.00")
                            pkg = to_decimal(est_cost.get("packaging"), "0.00")
                            cost_basis = (mat + lab + pkg).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                            min_fair = (cost_basis * Decimal("1.20")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                            raw_sugg = to_decimal(parsed.get("suggested_price"), str(min_fair))
                            suggested = max(min_fair, raw_sugg).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                            pricing_source = "AI_ESTIMATE"
                            pricing_available = True

                        return {
                            "source": "LIVE_AI",
                            "is_live_ai": True,
                            "is_demo_data": False,
                            "requires_artisan_verification": True,
                            "title": parsed.get("title", clean_desc[:80]),
                            "category": parsed.get("category", clean_category_hint or "Handloom"),
                            "materials": parsed.get("materials", "Craft materials as stated by artisan"),
                            "description": parsed.get("description", clean_desc),
                            "craft_story": parsed.get("craft_story", clean_desc),
                            "tags": parsed.get("tags", [clean_category_hint or "Handmade"]),
                            "suggested_price": suggested,
                            "min_fair_price": min_fair,
                            "material_cost": mat,
                            "labour_cost": lab,
                            "packaging_cost": pkg,
                            "min_margin_pct": Decimal("0.20"),
                            "pricing_available": pricing_available,
                            "pricing_source": pricing_source,
                            "image_url": clean_image,
                            "enhanced_image_url": clean_image,
                            "transcription": clean_desc,
                            "language_detected": language,
                            "lifecycle_state": "AI_GENERATED",
                            "notice": "AI-generated draft. Factual heritage, materials, and pricing claims must be verified by the artisan before publishing."
                        }
        except Exception as e:
            import logging
            logging.getLogger("artisan_ai").warning("[AI Adapter] Live Gemini call unavailable or timed out: %s", str(e))

    # -------------------------------------------------------------------------
    # 2. PRODUCTION MANUAL DRAFT (100% Honest Draft — Zero Fabrications)
    # -------------------------------------------------------------------------
    return build_production_manual_draft(
        voice_description=clean_desc,
        language=language,
        image_url=clean_image,
        category_hint=clean_category_hint,
        material_cost=material_cost,
        labour_cost=labour_cost,
        packaging_cost=packaging_cost
    )