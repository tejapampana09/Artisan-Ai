
import os
import json
import logging
import httpx
from typing import Dict, Any, Optional, Tuple, List
from decimal import Decimal, ROUND_HALF_UP
from pydantic import BaseModel, Field

from backend.app.config import (
    GEMINI_API_KEY, 
    AI_REQUEST_TIMEOUT_SECONDS
)

from backend.app.schemas import ArtisanFacts
from backend.app.services.catalog_validator import validate_catalog_draft

def extract_artisan_facts(
    artisan_facts: Optional[Any] = None,
    qna_answers: Optional[Dict[str, str]] = None,
    voice_description: str = "",
    category_hint: Optional[str] = None
) -> ArtisanFacts:
    """
    Normalizes any input format (ArtisanFacts, dict, qna_answers, voice_description)
    into a canonical source-of-truth ArtisanFacts Pydantic instance without inferring unstated facts.
    Priority:
    A. artisan_facts (Pydantic model or dict)
    B. qna_answers (q1_title/q1_product, q2_materials, q3_story)
    C. voice_description (conservative fallback into special_characteristics)
    """
    if artisan_facts:
        if isinstance(artisan_facts, ArtisanFacts):
            af_dict = artisan_facts.model_dump()
        elif isinstance(artisan_facts, dict):
            af_dict = dict(artisan_facts)
        else:
            af_dict = {}

        raw_m = af_dict.get("materials", [])
        if isinstance(raw_m, str):
            clean_m = [item.strip() for item in raw_m.split(",") if item.strip()]
        elif isinstance(raw_m, list):
            clean_m = [str(item).strip() for item in raw_m if str(item).strip()]
        else:
            clean_m = []

        v_first_line = (voice_description or "").strip().split("\n")[0][:60].strip()
        p_name = (af_dict.get("product_name") or "").strip() or v_first_line

        return ArtisanFacts(
            product_name=p_name,
            craft_type=(af_dict.get("craft_type") or category_hint or "").strip(),
            materials=clean_m,
            handmade=af_dict.get("handmade"),
            making_time=(af_dict.get("making_time") or "").strip(),
            artisan_story=(af_dict.get("artisan_story") or "").strip(),
            special_characteristics=(af_dict.get("special_characteristics") or "").strip(),
        )

    v_clean = (voice_description or "").strip()
    v_first_line = v_clean.split("\n")[0][:60].strip() if v_clean else ""

    if qna_answers:
        q1 = (qna_answers.get('q1_title') or qna_answers.get('q1_product') or '').strip() or v_first_line
        q2 = (qna_answers.get('q2_materials') or '').strip()
        q3 = (qna_answers.get('q3_story') or '').strip()

        mat_list = []
        if q2:
            mat_list = [p.strip() for p in q2.split(",") if p.strip()]

        return ArtisanFacts(
            product_name=q1,
            craft_type=(category_hint or "").strip(),
            materials=mat_list,
            handmade=None,
            making_time="",
            artisan_story=q3,
            special_characteristics=v_clean
        )

    return ArtisanFacts(
        product_name=v_first_line,
        craft_type=(category_hint or "").strip(),
        materials=[],
        handmade=None,
        making_time="",
        artisan_story="",
        special_characteristics=v_clean
    )

def sanitize_materials(facts_materials: List[str], generated_materials: Any) -> List[str]:
    """
    Filters AI generated materials strictly against artisan facts.
    If facts_materials is empty, returns empty list [].
    If facts_materials is specified, filters out unmentioned materials.
    """
    if not facts_materials:
        return []

    if isinstance(generated_materials, str):
        gen_list = [m.strip() for m in generated_materials.split(",") if m.strip()]
    elif isinstance(generated_materials, list):
        gen_list = [str(m).strip() for m in generated_materials if str(m).strip()]
    else:
        gen_list = []

    facts_lower = [f.lower().strip() for f in facts_materials if f.strip()]
    sanitized = []
    for gen in gen_list:
        gen_l = gen.lower()
        if any(f in gen_l or gen_l in f for f in facts_lower):
            sanitized.append(gen)

    return sanitized if sanitized else facts_materials

def sanitize_craft_story(facts_story: str, generated_story: str, fallback_desc: str) -> str:
    """
    Validates that AI did not hallucinate family heritage/traditions when artisan_story is empty or non-hereditary.
    """
    fs_lower = (facts_story or "").lower()
    negative_signals = ["ఏమీ చెప్పలేదు", "చెప్పలేదు", "no family", "nothing", "not specified", "no story"]
    has_negative = any(neg in fs_lower for neg in negative_signals)

    has_explicit_heritage = (not has_negative) and any(
        kw in fs_lower
        for kw in ["family", "generations", "generation", "years", "ancestor", "తరాల", "సంవత్సరాల"]
    )
    if not has_explicit_heritage:
        forbidden = [
            "generation", "generations", "ancestral", "centuries-old",
            "passed down", "family tradition", "heritage tradition",
            "three generations", "20 years of family"
        ]
        gen_lower = (generated_story or "").lower()
        if any(f in gen_lower for f in forbidden):
            return fallback_desc or "Handcrafted artisan item created with traditional care."

    return generated_story or fallback_desc or "Handcrafted artisan item."

def to_decimal(val, default="0.00") -> Decimal:
    if val is None:
        return Decimal(default)
    return Decimal(str(val))

def extract_json_payload(content: str) -> Dict[str, Any]:
    """Safely extracts and parses JSON payload from LLM response text, handling surrounding prose/markdown."""
    clean_text = content.strip()
    if clean_text.startswith("```"):
        lines = clean_text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        clean_text = "\n".join(lines).strip()
    
    try:
        return json.loads(clean_text)
    except json.JSONDecodeError:
        start_idx = clean_text.find("{")
        end_idx = clean_text.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            json_snippet = clean_text[start_idx:end_idx + 1]
            return json.loads(json_snippet)
        raise

def get_models_to_try() -> list:
    """Returns an ordered fallback list of active Gemini models starting with configured GEMINI_MODEL."""
    from backend.app.config import GEMINI_MODEL, GEMINI_FALLBACK_MODELS
    models = [GEMINI_MODEL]
    for m in GEMINI_FALLBACK_MODELS:
        if m not in models:
            models.append(m)
    return models




def calculate_pricing_from_costs(
    mat: Optional[Any] = None,
    lab: Optional[Any] = None,
    pkg: Optional[Any] = None,
    oth: Optional[Any] = None
) -> Tuple[Optional[Decimal], Optional[Decimal], bool, str]:
    """
    Computes (min_fair_price, suggested_price, pricing_available, pricing_source)
    using Decimal arithmetic to prevent precision issues.
    Enforces a strict 20% minimum fair profit margin over total direct cost basis.
    Returns (None, None, False, "AWAITING_ARTISAN_INPUT") if no positive costs provided.
    """
    has_costs = any(
        c is not None and Decimal(str(c)) > 0
        for c in [mat, lab, pkg, oth]
    )
    if not has_costs:
        return None, None, False, "AWAITING_ARTISAN_INPUT"

    m = to_decimal(mat, "0.00")
    l = to_decimal(lab, "0.00")
    p = to_decimal(pkg, "0.00")
    o = to_decimal(oth, "0.00")
    cost_basis = (m + l + p + o).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    min_fair = (cost_basis * Decimal("1.20")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    suggested = (cost_basis * Decimal("1.40")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return min_fair, suggested, True, "COST_PLUS_MARGIN"

def build_production_manual_draft(
    voice_description: str = "",
    language: str = "en",
    image_url: Optional[str] = None,
    category_hint: Optional[str] = None,
    material_cost: Optional[Any] = None,
    labour_cost: Optional[Any] = None,
    packaging_cost: Optional[Any] = None,
    other_cost: Optional[Any] = None,
    qna_answers: Optional[Dict[str, str]] = None,
    artisan_facts: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Constructs a 100% honest manual draft when AI is unavailable in production.
    - Preserves canonical ArtisanFacts (product_name, materials, artisan_story, craft_type) without fabrication.
    - If costs are missing, pricing is left as None (pricing_available=False).
    """
    clean_desc = (voice_description or "").strip()
    clean_image = (image_url or "").strip()
    clean_cat = (category_hint or "").strip() or None

    facts = extract_artisan_facts(
        artisan_facts=artisan_facts,
        qna_answers=qna_answers,
        voice_description=clean_desc,
        category_hint=clean_cat
    )

    first_desc_line = clean_desc.split("\n")[0][:80].strip() if clean_desc else ""
    title = facts.product_name or first_desc_line or (f"Handcrafted {facts.craft_type or clean_cat}" if (facts.craft_type or clean_cat) else "Craft Draft (Pending Title)")
    category = facts.craft_type or clean_cat or "Handcrafted"
    materials_str = ", ".join(facts.materials) if facts.materials else ""
    story = facts.artisan_story or ""
    description = facts.special_characteristics or clean_desc or title

    min_fair, suggested, pricing_avail, pricing_src = calculate_pricing_from_costs(
        material_cost, labour_cost, packaging_cost, other_cost
    )

    mat_dec = to_decimal(material_cost) if material_cost is not None else None
    lab_dec = to_decimal(labour_cost) if labour_cost is not None else None
    pkg_dec = to_decimal(packaging_cost) if packaging_cost is not None else None
    oth_dec = to_decimal(other_cost) if other_cost is not None else None

    trans_map = {
        language: {"title": title, "description": description, "craft_story": story},
        "en": {"title": title, "description": description, "craft_story": story}
    }

    return {
        "source": "MANUAL_DRAFT",
        "is_live_ai": False,
        "is_demo_data": False,
        "requires_artisan_verification": True,
        "title": title,
        "category": category,
        "materials": materials_str,
        "description": description,
        "craft_story": story,
        "title_en": title,
        "description_en": description,
        "craft_story_en": story,
        "translations": json.dumps(trans_map),
        "tags": [category] if category else [],
        "suggested_price": suggested,
        "min_fair_price": min_fair,
        "material_cost": mat_dec,
        "labour_cost": lab_dec,
        "packaging_cost": pkg_dec,
        "other_cost": oth_dec,
        "min_margin_pct": Decimal("0.20"),
        "pricing_available": pricing_avail,
        "pricing_source": pricing_src,
        "image_url": clean_image,
        "enhanced_image_url": clean_image,
        "transcription": clean_desc,
        "language_detected": language,
        "lifecycle_state": "MANUAL_DRAFT",
        "notice": "Live AI generation is temporarily unavailable. Your verified artisan facts have been preserved as an editable manual draft. Please complete and verify details manually."
    }

import base64

async def prepare_image_part(image_url: str, client: httpx.AsyncClient) -> Optional[Dict[str, Any]]:
    if not image_url or not image_url.strip():
        return None
    url_str = image_url.strip()

    if url_str.startswith("data:image/"):
        try:
            header, base64_data = url_str.split(",", 1)
            mime_type = header.split(";")[0].replace("data:", "")
            return {
                "inline_data": {
                    "mime_type": mime_type,
                    "data": base64_data
                }
            }
        except Exception:
            return None

    if url_str.startswith("http://") or url_str.startswith("https://"):
        try:
            img_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
            }
            r = await client.get(url_str, timeout=10.0, follow_redirects=True, headers=img_headers)
            if r.status_code == 200 and r.content:
                mime_type = r.headers.get("content-type", "image/jpeg").split(";")[0]
                if not mime_type.startswith("image/"):
                    mime_type = "image/jpeg"
                encoded = base64.b64encode(r.content).decode("utf-8")
                return {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": encoded
                    }
                }
        except Exception:
            return None

    if os.path.exists(url_str):
        try:
            with open(url_str, "rb") as f:
                content = f.read()
            mime_type = "image/png" if url_str.lower().endswith(".png") else "image/jpeg"
            encoded = base64.b64encode(content).decode("utf-8")
            return {
                "inline_data": {
                    "mime_type": mime_type,
                    "data": encoded
                }
            }
        except Exception:
            return None

    return None

async def generate_catalog_draft(
    voice_description: str = "",
    language: str = "en",
    image_url: Optional[str] = None,
    category_hint: Optional[str] = None,
    material_cost: Optional[Any] = None,
    labour_cost: Optional[Any] = None,
    packaging_cost: Optional[Any] = None,
    other_cost: Optional[Any] = None,
    qna_answers: Optional[Dict[str, str]] = None,
    artisan_facts: Optional[Any] = None,
    force_fallback: bool = False
) -> Dict[str, Any]:
    """
    Generates an AI Catalog Draft with strict provenance and safety boundaries:
    - Canonical ArtisanFacts Source of Truth: Gemini receives single structured ArtisanFacts object.
    - Multimodal Vision: Accepts image payload for visual recognition when facts are minimal.
    - Decoupled Pricing: Pricing calculated separately via cost inputs or pricing engine.
    - Dual Language Output: Primary fields map to selected target language.
    """
    clean_desc = (voice_description or "").strip()
    clean_image = (image_url or "").strip()
    clean_category_hint = (category_hint or "").strip() or None

    artisan_facts_obj = extract_artisan_facts(
        artisan_facts=artisan_facts,
        qna_answers=qna_answers,
        voice_description=clean_desc,
        category_hint=clean_category_hint
    )
    facts_json_str = json.dumps(artisan_facts_obj.model_dump(), ensure_ascii=False, indent=2)

    has_user_costs = any(
        c is not None and Decimal(str(c)) > 0 
        for c in [material_cost, labour_cost, packaging_cost, other_cost]
    )

    # -------------------------------------------------------------------------
    # 1. LIVE GEMINI AI PATHWAY
    # -------------------------------------------------------------------------
    if GEMINI_API_KEY and not force_fallback:
        try:
            prompt = f"""You are Artisan AI's master cataloging assistant for traditional Indian handicrafts.
Your task is to transform the provided craft image and/or ARTISAN FACTS into clean, professional product catalog fields.

CANONICAL SOURCE OF TRUTH (ARTISAN FACTS):
{facts_json_str}

IMAGE & VISUAL RECOGNITION:
- If a craft product image is provided, perform visual recognition to identify the exact craft product type, visual style, traditional art form (e.g. Channapatna wooden toy, Kalamkari saree, Terracotta pot, Jaipur blue pottery, Tanjore painting, Brass idol, Handloom dupatta, Kanchipuram silk saree, Bidriware vase, etc.), and visible materials.
- If title/product_name in ARTISAN FACTS is empty or generic, use your visual analysis of the image to generate a specific, highly accurate title (max 10 words).

STRICT FACTUALITY RULES:
1. CRAFT STORY:
   - Create a polished craft story. If `artisan_story` or `special_characteristics` are provided, base it strictly on them. If empty, write a factual craft summary based on visual analysis of the craft.
2. MATERIALS:
   - Use materials explicitly listed in ARTISAN FACTS if provided. If empty, infer primary material from visual analysis of the image (e.g. Wood, Brass, Terracotta, Silk, Cotton, Clay, Marble, Bamboo).
3. PRICING:
   - Do NOT estimate, output, or include any prices, costs, or margins.
4. TITLE & DESCRIPTION:
   - Create a clean, specific product title (max 10 words) and product overview (2-3 sentences).
5. CATEGORY & TAGS:
   - Select an appropriate category (e.g. Toys & Games, Home Decor, Apparel & Sarees, Kitchenware, Jewellery) and 4-6 relevant discovery tags.
6. TRANSLATIONS:
   - Provide title, description, and craft_story in English AND in target native language '{language}'.

Return a valid JSON object matching this schema EXACTLY:
{{
  "title": "Specific product title in English",
  "description": "Product overview in English (2-3 sentences)",
  "craft_story": "Factual craft story in English",
  "materials": ["Material 1"],
  "category": "Category Name",
  "tags": ["tag1", "tag2", "tag3"],
  "native_title": "Product title in target language ({language})",
  "native_description": "Product overview in target language ({language})",
  "native_craft_story": "Factual craft story in target language ({language})"
}}"""

            models_to_try = get_models_to_try()
            async with httpx.AsyncClient(timeout=AI_REQUEST_TIMEOUT_SECONDS) as client:
                parts = [{"text": prompt}]
                if clean_image:
                    img_part = await prepare_image_part(clean_image, client)
                    if img_part:
                        parts.append(img_part)

                res = None
                for model in models_to_try:
                    try:
                        resp = await client.post(
                            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}",
                            json={
                                "contents": [{"parts": parts}],
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
                    parsed = extract_json_payload(content)

                    # Validate required core fields from AI
                    if "title" in parsed or "native_title" in parsed:
                        # Application-side strict sanitization for materials
                        mat_list = sanitize_materials(artisan_facts_obj.materials, parsed.get("materials"))
                        materials_str = ", ".join(mat_list) if mat_list else ""

                        # Application-side cleaning for tags
                        raw_tags = parsed.get("tags", [])
                        if isinstance(raw_tags, list):
                            tags_list = [str(t).strip() for t in raw_tags if str(t).strip()]
                        else:
                            tags_list = [clean_category_hint or "Handmade"]

                        # Decoupled pricing logic
                        if has_user_costs:
                            min_fair, suggested, pricing_available, pricing_source = calculate_pricing_from_costs(
                                material_cost, labour_cost, packaging_cost, other_cost
                            )
                            mat = to_decimal(material_cost, "0.00")
                            lab = to_decimal(labour_cost, "0.00")
                            pkg = to_decimal(packaging_cost, "0.00")
                            oth = to_decimal(other_cost, "0.00")
                        else:
                            min_fair = None
                            suggested = None
                            pricing_available = False
                            pricing_source = "AWAITING_ARTISAN_INPUT"
                            mat = lab = pkg = oth = Decimal("0.00")

                        title_en = parsed.get("title") or artisan_facts_obj.product_name or clean_desc[:80] or "Handcrafted Craft Item"
                        desc_en = parsed.get("description") or clean_desc or "Handmade artisan craft product."
                        raw_story_en = parsed.get("craft_story") or artisan_facts_obj.artisan_story or desc_en
                        story_en = sanitize_craft_story(artisan_facts_obj.artisan_story, raw_story_en, desc_en)

                        title_native = parsed.get("native_title") or title_en
                        desc_native = parsed.get("native_description") or desc_en
                        raw_story_native = parsed.get("native_craft_story") or story_en
                        story_native = sanitize_craft_story(artisan_facts_obj.artisan_story, raw_story_native, desc_native)

                        trans_map = {
                            language: {"title": title_native, "description": desc_native, "craft_story": story_native},
                            "en": {"title": title_en, "description": desc_en, "craft_story": story_en}
                        }

                        # Run ImageEnhancementService pipeline for studio lighting & backdrop composition
                        enhanced_image_url = clean_image
                        if clean_image:
                            try:
                                from backend.app.services.image_enhancer import enhance_studio_image
                                enhanced_data, is_enh, enh_msg = await enhance_studio_image(clean_image)
                                if is_enh and enhanced_data:
                                    enhanced_image_url = enhanced_data
                            except Exception as e:
                                logging.getLogger("artisan_ai").warning("[ImageEnhancement] Studio enhancement pipeline skipped: %s", str(e))

                        primary_title = title_native if language != "en" else title_en
                        primary_desc = desc_native if language != "en" else desc_en
                        primary_story = story_native if language != "en" else story_en

                        raw_draft = {
                            "source": "LIVE_AI",
                            "is_live_ai": True,
                            "is_demo_data": False,
                            "requires_artisan_verification": True,
                            "title": primary_title,
                            "category": parsed.get("category", clean_category_hint or "Handcrafted"),
                            "materials": materials_str,
                            "description": primary_desc,
                            "craft_story": primary_story,
                            "title_en": title_en,
                            "description_en": desc_en,
                            "craft_story_en": story_en,
                            "translations": json.dumps(trans_map),
                            "tags": tags_list,
                            "suggested_price": suggested,
                            "min_fair_price": min_fair,
                            "material_cost": mat,
                            "labour_cost": lab,
                            "packaging_cost": pkg,
                            "other_cost": oth,
                            "min_margin_pct": Decimal("0.20"),
                            "pricing_available": pricing_available,
                            "pricing_source": pricing_source,
                            "image_url": clean_image,
                            "enhanced_image_url": enhanced_image_url,
                            "transcription": clean_desc,
                            "language_detected": language,
                            "lifecycle_state": "AI_GENERATED",
                            "artisan_facts": artisan_facts_obj.model_dump(),
                            "ai_observations": {
                                "visual_materials": parsed.get("materials", []),
                                "visual_category": parsed.get("category", clean_category_hint or "Handcrafted"),
                                "visual_tags": tags_list
                            },
                            "notice": "AI-generated draft. Factual heritage and materials claims must be verified by the artisan before publishing."
                        }
                        return validate_catalog_draft(raw_draft, artisan_facts_obj)
        except Exception as e:
            logging.getLogger("artisan_ai").warning("[AI Adapter] Live Gemini call unavailable or timed out: %s", str(e))

    # -------------------------------------------------------------------------
    # 2. PRODUCTION MANUAL DRAFT (100% Honest Draft — Zero Fabrications)
    # -------------------------------------------------------------------------
    raw_manual_draft = build_production_manual_draft(
        voice_description=clean_desc,
        language=language,
        image_url=clean_image,
        category_hint=clean_category_hint,
        material_cost=material_cost,
        labour_cost=labour_cost,
        packaging_cost=packaging_cost,
        other_cost=other_cost,
        qna_answers=qna_answers,
        artisan_facts=artisan_facts_obj
    )
    return validate_catalog_draft(raw_manual_draft, artisan_facts_obj)


async def extract_buyer_intent(
    message: str,
    language: str = "te",
    category_hint: Optional[str] = None,
    max_budget_hint: Optional[float] = None
) -> Dict[str, Any]:
    """
    Extracts structured intent (category, budget, refined search keywords) from natural language query.
    1. Attempts LLM intent extraction via Gemini API when GEMINI_API_KEY is available.
    2. Falls back seamlessly to refined rule-based regex & dictionary matching.
    """
    import re
    raw_msg = (message or "").strip().lower()

    cat_keywords = {
        "Kalamkari": ["kalamkari", "machilipatnam", "srikalahasti", "దుపట్టా", "కలంకారి", "మచిలీపట్నం", "శ్రీకాళహస్తి", "कलमकारी", "saree", "dupatta", "fabric"],
        "Wooden Toys": ["toy", "toys", "wooden", "channapatna", "బొమ్మలు", "చెక్క", "చెన్నపట్న", "खिलौने", "लकड़ी", "sculpture"],
        "Blue Pottery": ["pottery", "blue pottery", "bowl", "plate", "పాట్టరీ", "జైపూర్", "पॉटरी", "जयपुर"],
        "Bidriware": ["bidri", "bidriware", "silver", "బీదర్", "బిద్రి", "बीदरी", "चांदी"],
        "Pochampally Ikat": ["ikat", "pochampally", "పోచంపల్లి", "इकत"],
        "Terracotta": ["terracotta", "clay", "మట్టి", "టెర్రకోట", "मिट्टी"],
        "Handloom": ["handloom", "shirt", "shawl", "హ్యాండ్‌లూమ్", "చేనేత", "हैंडलूम"]
    }

    rule_cat = category_hint
    category_words = set()
    if not rule_cat:
        for cat, kws in cat_keywords.items():
            for kw in kws:
                if kw in raw_msg:
                    rule_cat = cat
                    category_words.update(kw.split())
                    break
            if rule_cat:
                break
    else:
        if rule_cat in cat_keywords:
            for kw in cat_keywords[rule_cat]:
                category_words.update(kw.split())

    rule_budget = max_budget_hint
    if not rule_budget:
        budget_match = re.search(r'(?:under|below|lopu|less than|₹|rs|రూ|రూపాయల|\bs\b)?\s*(\d+)', raw_msg)
        if budget_match:
            try:
                rule_budget = float(budget_match.group(1))
            except ValueError:
                rule_budget = None

    stop_words = {
        "want", "show", "need", "give", "kavali", "kaho", "chupinchu", "kya", "have",
        "under", "below", "less", "than", "price", "cost", "rs", "inr", "rupees", "lopu",
        "me", "for", "with", "and", "or", "looking", "search", "buy", "purchase", "uniki",
        "idi", "unsi", "hai", "mujhe", "please", "can", "you", "get", "find", "some", "items",
        "products", "craft", "crafts", "artisan", "heritage", "gi", "art", "tell", "about",
        "explain", "what", "how", "details", "detail", "info", "information", "history", "story",
        "difference", "meaning", "guide", "gurinchi", "cheppu", "enti", "ela", "charithra",
        "batao", "samjhao", "itihas"
    }

    raw_words = re.findall(r'\w+', raw_msg)
    refined_keywords = [
        w for w in raw_words
        if len(w) > 2 and w not in stop_words and w not in category_words and not w.isdigit()
    ]

    rule_intent = {
        "category": rule_cat,
        "max_budget": rule_budget,
        "keywords": refined_keywords,
        "source": "RULE_BASED"
    }

    if GEMINI_API_KEY:
        try:
            prompt = f"""
            You are an intent extraction engine for an Indian artisan marketplace.
            Extract structured intent from user message: "{message}".
            Known categories: Kalamkari, Wooden Toys, Blue Pottery, Bidriware, Pochampally Ikat, Terracotta, Handloom.

            Return a valid JSON object with:
            - category: matched category name string or null
            - max_budget: price cap in INR as a number or null
            - keywords: array of 1-3 specific search term strings (excluding stop words and category names)
            """
            models_to_try = get_models_to_try()
            async with httpx.AsyncClient(timeout=4.5) as client:
                res = None
                for model in models_to_try[:2]:
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
                    parsed = extract_json_payload(content)

                    return {
                        "category": category_hint or parsed.get("category") or rule_cat,
                        "max_budget": max_budget_hint or parsed.get("max_budget") or rule_budget,
                        "keywords": parsed.get("keywords") if parsed.get("keywords") is not None else refined_keywords,
                        "source": "LIVE_GEMINI_LLM"
                    }
        except Exception:
            pass

    return rule_intent


CRAFT_HERITAGE_KNOWLEDGE = [
    {
        "keywords": ["kalamkari", "కలంకారి", "శ్రీకాళహస్తి", "మచిలీపట్నం", "कलमकारी"],
        "responses": {
            "te": "కలంకారి అనేది 3,000 సంవత్సరాల ఘన చరిత్ర కలిగిన ప్రాచీన చేతివృత్తి. శ్రీకాళహస్తి మరియు మచిలీపట్నం GI గుర్తింపు పొందిన ఈ కళలో, మాస్టర్ కళాకారులు వెదురు కలం (కలం) తో సహజసిద్ధమైన దానిమ్మ తొక్క, నీలిమందు, కరక్కాయ మరియు పటిక వంటి 100% ఆర్గానిక్ రంగులను ఉపయోగించి ప్యూర్ కాటన్ మరియు సిల్క్‌పై అద్భుతమైన చిత్రాలను తీర్చిదిద్దుతారు.",
            "hi": "कलमकारी 3,000 साल पुरानी प्रामाणिक भारतीय हस्तकला है। आंध्र प्रदेश के श्रीकालहस्ती और मछलीपट्टनम की जीआई-प्रमाणित इस कला में बांस की कलम और 100% प्राकृतिक वनस्पति रंगों (अनार के छिलके, नील, हल्दी) से शुद्ध रेशम और सूती कपड़ों पर हाथ से नक्काशीदार चित्रकारी की जाती है।",
            "en": "Kalamkari is an ancient 3,000-year-old organic textile art from Andhra Pradesh. Honoring Machilipatnam and Srikalahasti GI traditions, master artisans use hand-carved bamboo pens (kalams) and 100% natural plant dyes (indigo, pomegranate, madder root, myrobalan) to create timeless motifs on pure handloom cotton and mulberry silk.",
            "ta": "கலம்காரி என்பது 3000 ஆண்டுகள் பழமையான இந்திய பாரம்பரிய கைவினைக்கலையாகும். ஸ்ரீகாளஹஸ்தி மற்றும் மச்சிலிப்பட்டினம் புவிசார் குறியீடு (GI) பெற்ற இந்த கலையில், மூங்கில் பேனா மற்றும் மாதுளை, அவுரி போன்ற 100% இயற்கை தாவர சாயங்கள் மட்டுமே பயன்படுத்தப்படுகின்றன.",
            "bn": "কলমকারী ৩,০০০ বছরের প্রাচীন ঐতিহ্যবাহী ভারতীয় বস্ত্রশিল্প। অন্ধ্রপ্রদেশের শ্রীকালহস্তী ও মছিলিপত্তনম জিআই-স্বীকৃত এই শিল্পে বাঁশের কলম ও ১০০% প্রাকৃতিক রঙের সাহায্যে খাঁটি সুতি ও রেশমের উপর অপূর্ব নকশা আঁকা হয়।"
        }
    },
    {
        "keywords": ["channapatna", "toy", "wooden", "బొమ్మలు", "చెన్నపట్న", "చెక్క", "खिलौने", "लकड़ी"],
        "responses": {
            "te": "కర్ణాటకలోని చెన్నపట్న 'టాయ్ టౌన్' నుండి వచ్చిన ఈ జిఐ (GI) ట్యాగ్ బొమ్మలు 100% పర్యావరణహితం మరియు చిన్నారులకు సురక్షితమైనవి. వీటిని ఆలే మార (ఐవరీ వుడ్) చెక్కతో సంప్రదాయ లేత్‌లపై తిప్పుతూ, పసుపు, నీలిమందు, కుంకుమ వంటి సేంద్రీయ కూరగాయల రంగులతో సహజంగా మెరిసేలా తీర్చిదిద్దుతారు.",
            "hi": "कर्नाटक का चन्नापटना 'खिलौनों का शहर' अपने जीआई प्रमाणित लकड़ी के खिलौनों के लिए प्रसिद्ध है। ये 100% सुरक्षित और गैर-विषाक्त होते हैं, जिन्हें आले मारा (हाथीदांत लकड़ी) पर पारंपरिक खराद से तराशकर हल्दी, नील व लाख के प्राकृतिक रंगों से पॉलिश किया जाता है।",
            "en": "Channapatna toys, known as Karnataka's 'Toy Town' heritage, are GI-certified handcrafted wooden creations. Turned on traditional lathes using soft ivory wood (Wrightia tinctoria), they are colored with 100% organic, child-safe vegetable dyes (turmeric, indigo, kumkum) and sealed with natural tree lac.",
            "ta": "கர்நாடகாவின் சென்னபட்னா மர பொம்மைகள் புவிசார் குறியீடு (GI) பெற்றவை. இவை மென்மையான மரத்தில் செய்யப்பட்டு, மஞ்சள், இண்டிகோ போன்ற நச்சுத்தன்மையற்ற இயற்கை காய்கறி வண்ணங்களால் பூசப்பட்டு குழந்தைகளுக்கு முற்றிலும் பாதுகாப்பானவை.",
            "bn": "কর্ণাটকের চন্নপট্টনা জিআই-স্বীকৃত কাঠের খেলনা সম্পূর্ণ নিরাপদ ও পরিবেশবান্ধব। এগুলি নরম আলেক কাঠে তৈরি করে হলুদ ও নীলের মতো ভেষজ রঙের মাধ্যমে পালিশ করা হয়।"
        }
    },
    {
        "keywords": ["gi tag", "gi tagged", "geographical indication", "భౌగోళిక", "జిఐ", "जीआई"],
        "responses": {
            "te": "భౌగోళిక గుర్తింపు (GI ట్యాగ్) అనేది భారత ప్రభుత్వం ఒక నిర్దిష్ట ప్రాంత విశిష్ట వారసత్వ కళారూపాలకు ఇచ్చే అధికారిక ధ్రువీకరణ. ఇది నకిలీ ఉత్పత్తులను నివారించి, సాంప్రదాయ మాస్టర్ కళాకారులకు న్యాయమైన ఆదాయం మరియు నిజమైన ప్రామాణికతను అందిస్తుంది.",
            "hi": "भौगोलिक उपदर्शन (GI टैग) भारत सरकार द्वारा किसी विशेष क्षेत्र की अनूठी पारंपरिक कलाकृतियों को दी जाने वाली कानूनी मान्यता है। यह नकल रोकने और असली कारीगरों को उनका सही मूल्य व संरक्षण दिलाने की गारंटी देता है।",
            "en": "A Geographical Indication (GI) tag is an official intellectual property certification granted to heritage crafts originating from a specific geography. It legally protects rural artisans from factory counterfeits and guarantees that materials, techniques, and authenticity strictly adhere to historical standards.",
            "ta": "புவிசார் குறியீடு (GI Tag) என்பது குறிப்பிட்ட பகுதியில் உருவாகும் பாரம்பரிய கைவினைப் பொருட்களுக்கு வழங்கப்படும் சட்டப்பூர்வ சான்றிதழாகும். இது போலி தயாரிப்புகளில் இருந்து உண்மையான கைவினைஞர்களைப் பாதுகாக்கிறது.",
            "bn": "ভৌগোলিক নির্দেশক (GI ট্যাগ) হলো কোনো নির্দিষ্ট অঞ্চলের ঐতিহ্যবাহী শিল্পকে প্রদত্ত সরকারি স্বীকৃতি, যা কারিগরদের ন্যায্য অধিকার রক্ষা করে এবং নকল রোধ করে।"
        }
    },
    {
        "keywords": ["blue pottery", "pottery", "jaipur", "బ్లూ పాటరీ", "పాట్టరీ", "पॉटरी", "जयपुर"],
        "responses": {
            "te": "జైపూర్ బ్లూ పాటరీ అనేది బంకమట్టిని అస్సలు ఉపయోగించకుండా తయారుచేసే ప్రపంచంలోనే అరుదైన కళ. క్వార్ట్జ్ రాయి పొడి, గాజు మరియు ముల్తానీ మిట్టి మిశ్రమంతో రూపుదిద్దుకుని, పెర్షియన్ నీలం కోబాల్ట్ ఆక్సైడ్ రంగుతో గాజు మెరుపు వచ్చేలా బట్టీల్లో కాల్చుతారు.",
            "hi": "जयपुर की ब्लू पॉटरी बिना मिट्टी के बनाई जाने वाली दुनिया की अनोखी कला है। यह क्वार्ट्ज पाउडर, कांच और मुल्तानी मिट्टी के मिश्रण से बनती है और कोबाल्ट ऑक्साइड के खूबसूरत नीले रंग से रंगी जाकर पारंपरिक भट्ठियों में पकाई जाती है।",
            "en": "Jaipur Blue Pottery is a unique craft sculpted entirely without clay. Master potters craft it from a special dough of quartz powder, powdered glass, and Multani Mitti, glazed with vibrant Persian cobalt blue and turquoise botanical motifs fired in traditional kilns.",
            "ta": "ஜெய்ப்பூர் நீல மண்பாண்டம் (Blue Pottery) களிமண் இல்லாமல் குவார்ட்ஸ் தூள் மற்றும் கண்ணாடியால் செய்யப்படும் ஒரு தனித்துவமான ராஜஸ்தானிய கலைப்படைப்பாகும்.",
            "bn": "জয়পুর ব্লু পটারি মাটি ছাড়া কোয়ার্টজ ও কাঁচের গুঁড়ো দিয়ে তৈরি একটি বিশেষ ঐতিহ্যবাহী রাজস্থানি শিল্প।"
        }
    },
    {
        "keywords": ["bidri", "bidriware", "silver", "బిద్రి", "బీదర్", "बीदरी", "चांदी"],
        "responses": {
            "te": "బిద్రివేర్ అనేది కర్ణాటకలోని బీదర్ నుండి వచ్చిన 500 ఏళ్ల నాటి విశిష్ట లోహ కళ. జింక్ మరియు రాగి మిశ్రమంపై 99.9% స్వచ్ఛమైన వెండి తీగలను చేతితో పొదిగి, చారిత్రక బీదర్ కోట మట్టితో శాశ్వత నల్లటి మెరుపును తీసుకొస్తారు.",
            "hi": "बीदरी कला 500 साल पुरानी जीआई-प्रमाणित धातु कला है। इसमें जस्ता और तांबे की मिश्रधातु पर 99.9% शुद्ध चांदी के तारों की बारीक नक्काशी की जाती है और बीदर के ऐतिहासिक किले की खास मिट्टी से इसे मखमली काला रंग दिया जाता है।",
            "en": "Bidriware is a 500-year-old GI-protected metal art form originating from Bidar, Karnataka. Artisans engrave intricate geometric and floral patterns onto a blackened zinc-copper alloy, inlaying pure 99.9% silver wire and treating the surface with historical Bidar Fort soil.",
            "ta": "பித்ரிவேர் (Bidriware) என்பது பிதார் பகுதியின் 500 ஆண்டுகள் பழமையான உலோகம் மற்றும் தூய வெள்ளி இழை வேலைப்பாடாகும்.",
            "bn": "বিদরিওয়্যার কর্ণাটকের বিদার শহরের ৫০০ বছরের প্রাচীন জিআই-স্বীকৃত রৌপ্য খোদাই করা অনন্য ধাতব শিল্প।"
        }
    },
    {
        "keywords": ["silk", "chanderi", "ikat", "pochampally", "పట్టు", "పోచంపల్లి", "చందేరి", "రేశం", "इकत"],
        "responses": {
            "te": "స్వచ్ఛమైన చందేరి మరియు పోచంపల్లి ఇకత్ చేనేత పట్టు వస్త్రాలు వాటి సహజమైన మెరుపు, తేలికపాటి నేత మరియు సిల్క్ మార్క్ ప్రామాణికత ద్వారా ప్రసిద్ధి చెందాయి. ఒక చిన్న దారాన్ని కాల్చినప్పుడు సహజ జుట్టు వాసనతో బూడిద అవుతుంది, అదే సింథటిక్ అయితే ప్లాస్టిక్ ముద్దలా మారుతుంది.",
            "hi": "शुद्ध चंदेरी और पोचमपल्ली इकत रेशमी साड़ियां अपने हल्के वजन, प्राकृतिक चमक और सिल्क मार्क प्रमाणन के लिए जानी जाती हैं। धागे के जलने पर प्राकृतिक राख और महक इसकी शुद्धता का प्रमाण है।",
            "en": "Authentic Chanderi and Pochampally Ikat silks are handwoven masterworks celebrated for their featherlight drape and geometric tie-dye precision. Genuine pieces feature the official Silk Mark certification and are woven by hand on traditional pit and frame looms.",
            "ta": "உண்மையான போச்சம்பள்ளி இக்கத் மற்றும் சந்தேரி பட்டுப் புடவைகள் கைத்தறி நெசவின் சிறப்பம்சமாகும், இவை சில்க் மார்க் சான்றிதழ் கொண்டவை.",
            "bn": "খাঁটি চান্দেরী ও পোচমপল্লী ইকত শাড়ি ভারতীয় হস্তচালিত তাঁতের এক অনন্য সৃষ্টি।"
        }
    },
    {
        "keywords": ["terracotta", "clay", "మట్టి", "టెర్రకోట", "मिट्टी"],
        "responses": {
            "te": "టెర్రకోట అనేది ప్రాచీన సింధు నాగరికత కాలం నుండి వస్తున్న స్వచ్ఛమైన బంకమట్టి కళ. నదీ తీరపు ఒండ్రు మట్టిని మెత్తగా పిసికి, చక్రంపై తిప్పి, ఆపై సహజ కలప మంటల్లో కాల్చి పర్యావరణహిత కుండలు, పూల కుండీలు మరియు విగ్రహాలను రూపొందిస్తారు.",
            "hi": "टेराकोटा मिट्टी से बनी प्रामाणिक कला है, जो सिंधु घाटी सभ्यता जितनी प्राचीन है। प्राकृतिक नदी तट की मिट्टी को पारंपरिक चाक पर आकार देकर भट्ठी में पकाकर टिकाऊ व पर्यावरण के अनुकूल कलाकृतियां बनाई जाती हैं।",
            "en": "Terracotta is one of humanity's oldest craft forms, rooted in the Indus Valley tradition. Using alluvial riverbed clay shaped on traditional potters' wheels and fired in wood-fueled kilns, artisans craft breathable cookware, ornamental urns, and sacred figurines.",
            "ta": "சுடுமண் கலை (Terracotta) என்பது நதிக்கரை களிமண்ணைக் கொண்டு சக்கரத்தில் வனையப்பட்டு தீயில் சுடப்படும் பழமையான இயற்கை கைவினைக்கலையாகும்.",
            "bn": "টেরাকোটা বা পোড়ামাটির কাজ ভারতের অন্যতম প্রাচীন প্রাকৃতিক মৃত্শিল্প।"
        }
    },
    {
        "keywords": ["custom", "order", "inquire", "artisan", "కస్టమ్", "ఆర్డర్", "कस्टम", "ऑर्डर"],
        "responses": {
            "te": "మీకు నచ్చిన ప్రత్యేకమైన డిజైన్ లేదా సైజులో చేతివృత్తుల కళాకృతులు కావాలంటే, మీరు నేరుగా మాస్టర్ కళాకారులకు 'కస్టమ్ ఆర్డర్ ఎంక్వైరీ' పంపవచ్చు. కళాకారులు మీ అవసరాలకు అనుగుణంగా స్వయంగా తయారుచేసి అందిస్తారు.",
            "hi": "यदि आप अपनी पसंद का विशेष हस्तशिल्प या अनुकूलित कलाकृति बनवाना चाहते हैं, तो आप सीधे हमारे कारीगरों को 'कस्टम इंक्वायरी' भेज सकते हैं। वे आपके लिए विशेष रूप से हाथ से तैयार करेंगे।",
            "en": "Yes! You can request custom made-to-order creations directly from our verified master artisans. Simply tap 'Ask Artisan' on any craft page to specify your preferred dimensions, motifs, or special heritage requests.",
            "ta": "ஆம்! உங்களுக்கு விருப்பமான தனிப்பயன் (Custom) கைவினைப்பொருட்களை எங்கள் கைவினைஞர்களிடம் நேரடியாக ஆர்டர் செய்யலாம்.",
            "bn": "হ্যাঁ! আপনি আপনার পছন্দের বিশেষ নকশা বা মাপ অনুযায়ী সরাসরি আমাদের কারিগরদের সাথে যোগাযোগ করে কাস্টম অর্ডার দিতে পারেন।"
        }
    }
]

async def generate_buyer_explanation(
    user_message: str,
    language: str,
    product_titles: list,
    match_count: int,
    is_fallback: bool
) -> str:
    """
    Generates natural language response explaining recommendations and answering craft inquiries.
    Uses Gemini LLM when available, or returns precise, expert domain heritage knowledge.
    Strictly avoids claiming false GI certification on unverified fallback items.
    """
    lang = (language or "te").lower()

    if GEMINI_API_KEY:
        try:
            prompt = f"""
            You are "Artisan AI Companion", a knowledgeable, culturally rich, and warm guide for Indian traditional crafts, GI-tagged heritage arts, and rural master artisans.

            User Inquiry: "{user_message}"
            Language Code: "{lang}" (Respond in natural, fluent, warm {lang}. E.g., if 'te', respond in authentic Telugu; if 'hi', Hindi; if 'ta', Tamil; if 'bn', Bengali; if 'en', English).
            Matching Products in Store: {match_count} ({product_titles[:4] if product_titles else "None directly listed currently"}).
            Is Fallback Selection: {is_fallback}.

            Instructions:
            1. Directly answer the user's question with genuine heritage knowledge (origins, materials, traditional technique, GI tag significance, or care).
            2. If matching products are available in our store ({match_count} items), warmly invite the user to view the listings below.
            3. If no matching products exist in the store, still answer the question thoroughly and mention they can request custom made-to-order creations from our verified artisans.
            4. Keep the tone warm, authentic, and concise (2-4 sentences). Do NOT output robotic system phrases.
            """
            models_to_try = get_models_to_try()
            async with httpx.AsyncClient(timeout=5.0) as client:
                for model in models_to_try[:2]:
                    try:
                        resp = await client.post(
                            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}",
                            json={
                                "contents": [{"parts": [{"text": prompt}]}]
                            },
                            headers={"Content-Type": "application/json"}
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                            if text:
                                return text
                    except Exception:
                        continue
        except Exception:
            pass

    # Built-in Authentic Craft Heritage Knowledge Engine (instant fallback when LLM is unavailable or rate-limited)
    msg_l = (user_message or "").lower()
    for item in CRAFT_HERITAGE_KNOWLEDGE:
        if any(kw in msg_l for kw in item["keywords"]):
            ans = item["responses"].get(lang) or item["responses"].get("en")
            if match_count > 0:
                if lang == "te":
                    return f"{ans}\n\nమా మార్కెట్‌ప్లేస్‌లో మీకోసం అందుబాటులో ఉన్న {match_count} అథెంటిక్ కళారూపాలు కింద చూడవచ్చు:"
                elif lang == "hi":
                    return f"{ans}\n\nहमारे बाज़ार में उपलब्ध {match_count} प्रामाणिक उत्पाद नीचे देख सकते हैं:"
                else:
                    return f"{ans}\n\nExplore {match_count} authentic handcrafted creations currently available in our marketplace below:"
            return ans

    # Honest localized fallback responses for shopping or general browsing
    if is_fallback:
        if lang == "te":
            return "మీ శోధనకు తగిన సాంప్రదాయ కళారూపాలు ప్రస్తుతం మార్కెట్‌ప్లేస్‌లో సిద్ధంగా లేవు. అయితే, మీరు మాస్టర్ కళాకారులకు కస్టమ్ ఆర్డర్ ఎంక్వైరీ పంపవచ్చు లేదా ఈ ఇతర చేతివృత్తుల ఉత్పత్తులను చూడవచ్చు:"
        elif lang == "hi":
            return "आपकी खोज के लिए अभी सटीक उत्पाद स्टॉक में नहीं हैं। आप हमारे कारीगरों को कस्टम ऑर्डर इंक्वायरी भेज सकते हैं या इन अन्य लोकप्रिय कृतियों को देख सकते हैं:"
        elif lang == "ta":
            return "உங்கள் தேடலுக்கு நேரடி தயாரிப்புகள் தற்போது இருப்பில் இல்லை. எங்கள் கைவினைஞர்களிடம் தனிப்பயன் ஆர்டர் செய்யலாம் அல்லது இவற்றை பார்க்கலாம்:"
        elif lang == "bn":
            return "আপনার অনুসন্ধানের জন্য সরাসরি পণ্য বর্তমানে উপলব্ধ নেই। আপনি কারিগরদের কাস্টম অর্ডার অনুরোধ পাঠাতে পারেন অথবা এই সামগ্রীগুলি দেখতে পারেন:"
        else:
            return "We don't currently have immediate in-stock items matching that exact craft, but you can place a custom made-to-order inquiry with our master artisans, or explore these handcrafted creations:"
    else:
        if lang == "te":
            return f"అభివందనాలు! మీ శోధన ('{user_message}') ప్రకారం లైవ్ మార్కెట్‌ప్లేస్‌లో {match_count} అథెంటిక్ చేతివృత్తుల కళారూపాలు లభించాయి:"
        elif lang == "hi":
            return f"नमस्ते! आपकी खोज ('{user_message}') के अनुसार लाइव मार्केटप्लेस में {match_count} प्रामाणिक हस्तशिल्प उत्पाद मिले हैं:"
        elif lang == "ta":
            return f"வணக்கம்! உங்கள் தேடலின் படி ({match_count}) நேரலை கைவினைப்பொருட்கள் கண்டறியப்பட்டுள்ளன:"
        elif lang == "bn":
            return f"নমস্কার! আপনার অনুসন্ধান অনুযায়ী ({match_count}) কারিগর সামগ্রী পাওয়া গেছে:"
        else:
            return f"Hello! I found {match_count} authentic master artisan crafts matching '{user_message}' in our marketplace:"

async def translate_craft_text(
    title: str,
    description: str,
    craft_story: str = "",
    target_language: str = "en"
) -> Dict[str, str]:
    """
    Translates product title, description, and craft story into target language using Gemini AI.
    Falls back gracefully if AI is unavailable.
    """
    if not title and not description and not craft_story:
        return {"title": "", "description": "", "craft_story": "", "target_language": target_language}

    lang_names = {
        "en": "English",
        "te": "Telugu",
        "hi": "Hindi",
        "ta": "Tamil",
        "bn": "Bengali"
    }
    script_names = {
        "en": "English / Latin alphabet",
        "te": "Telugu script (తెలుగు లిపి) only",
        "hi": "Devanagari script (देवनागरी लिपि) only",
        "ta": "Tamil script (தமிழ் எழுத்துக்கள்) only",
        "bn": "Bengali script (বাংলা লিপি) only"
    }
    target_name = lang_names.get(target_language, "English")
    target_script = script_names.get(target_language, "English / Latin alphabet")

    def has_devanagari(txt: str) -> bool:
        return any('\u0900' <= ch <= '\u097f' for ch in (txt or ""))

    if GEMINI_API_KEY:
        try:
            prompt = f"""
            You are an expert native translator for traditional Indian artisan crafts.
            Translate the following product information into {target_name} ({target_language}).

            CRITICAL SCRIPT & LANGUAGE RULES:
            - You MUST write the translation exclusively in {target_script}.
            - FOR TELUGU (te): NEVER output Devanagari or Hindi letters (अ, आ, क, etc.). You MUST write strictly in pure Telugu letters (అ, ఆ, క, మొదలైనవి).
            - FOR BENGALI (bn): NEVER output Devanagari or Hindi letters. You MUST write strictly in pure Bengali script (বাংলা লিপি).
            - FOR TAMIL (ta): NEVER output Devanagari or Hindi letters. You MUST write strictly in pure Tamil script (தமிழ் எழுத்துக்கள்).
            - Use authentic regional vocabulary (e.g., in Telugu use 'చేనేత' for handloom, 'నూలు / కాటన్' for cotton, 'సాంప్రదాయ' for traditional).
            - Output natural, fluent, culturally respectful phrasing.

            Title: "{title or ''}"
            Description: "{description or ''}"
            Craft Story: "{craft_story or ''}"

            Return a valid JSON object with:
            - title: Translated title in {target_name} using {target_script}
            - description: Translated description in {target_name} using {target_script}
            - craft_story: Translated craft story in {target_name} using {target_script}
            """
            models_to_try = get_models_to_try()
            async with httpx.AsyncClient(timeout=AI_REQUEST_TIMEOUT_SECONDS) as client:
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
                            data = resp.json()
                            content = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                            parsed = extract_json_payload(content)
                            res_title = parsed.get("title") or title
                            res_desc = parsed.get("description") or description
                            res_story = parsed.get("craft_story") or craft_story

                            # Strict rejection of Devanagari leakage into Telugu, Tamil, Bengali
                            if target_language in ("te", "ta", "bn") and has_devanagari(res_title):
                                continue

                            return {
                                "title": res_title,
                                "description": res_desc,
                                "craft_story": res_story,
                                "target_language": target_language
                            }
                    except Exception:
                        continue
        except Exception:
            pass

    return {
        "title": title,
        "description": description,
        "craft_story": craft_story,
        "target_language": target_language
    }




async def estimate_fair_price(
    title: str = "",
    category: str = "Handcrafted",
    materials: str = "",
    description: str = "",
    material_cost: Optional[Any] = None,
    labour_cost: Optional[Any] = None,
    packaging_cost: Optional[Any] = None,
    other_cost: Optional[Any] = None
) -> Dict[str, Any]:
    """
    AI Fair Market Price Estimator:
    If itemized costs are provided, uses cost + 35% fair margin (exceeding 20% floor).
    If costs are empty/zero, uses Gemini AI or market benchmarks for similar products.
    """
    min_fair, suggested, pricing_avail, pricing_src = calculate_pricing_from_costs(
        material_cost, labour_cost, packaging_cost, other_cost
    )
    if pricing_avail and suggested is not None and min_fair is not None:
        return {
            "suggested_price": suggested,
            "min_fair_price": min_fair,
            "pricing_source": pricing_src,
            "reasoning": "Calculated from artisan's reported direct costs with protected 35% profit margin."
        }

    clean_cat = (category or "Handcrafted").strip()
    clean_title = (title or "").strip()
    clean_mat = (materials or "").strip()

    if GEMINI_API_KEY:
        try:
            prompt = f"""
            You are an expert handicraft market valuation AI for traditional Indian artisan products.
            Product details:
            Title: "{clean_title}"
            Category: "{clean_cat}"
            Materials: "{clean_mat}"
            Description: "{description}"

            Task: Estimate a fair market selling price (in INR) for this item based on real market prices of similar handmade products in India.
            
            Return a valid JSON object with:
            - suggested_price: Fair market price in INR (number)
            - min_fair_price: Minimum recommended fair price in INR (number)
            - reasoning: 1-sentence explanation of market benchmarks for similar products
            """
            models_to_try = get_models_to_try()
            async with httpx.AsyncClient(timeout=AI_REQUEST_TIMEOUT_SECONDS) as client:
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
                            data = resp.json()
                            content = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                            parsed = extract_json_payload(content)
                            raw_sugg = parsed.get("suggested_price")
                            raw_min = parsed.get("min_fair_price")
                            if raw_sugg:
                                sugg_dec = Decimal(str(raw_sugg)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                                min_dec = Decimal(str(raw_min or float(sugg_dec) * 0.75)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                                return {
                                    "suggested_price": sugg_dec,
                                    "min_fair_price": min_dec,
                                    "pricing_source": "MARKET_AI_ESTIMATE",
                                    "reasoning": parsed.get("reasoning", f"Market price estimate based on similar {clean_cat} products in current Indian craft markets.")
                                }
                    except Exception:
                        continue
        except Exception:
            pass

    # Do not invent a category price when neither live market data nor artisan
    return {
        "suggested_price": None,
        "min_fair_price": None,
        "pricing_source": "AWAITING_MARKET_OR_COST_DATA",
        "reasoning": "No reliable market comparables or artisan cost inputs were available, so no price was invented."
    }
