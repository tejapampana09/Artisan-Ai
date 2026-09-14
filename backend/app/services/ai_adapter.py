
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
        "Kalamkari": ["kalamkari", "దుపట్టా", "కలంకారి", "कलमकारी", "saree", "dupatta", "fabric"],
        "Wooden Toys": ["toy", "wooden", "channapatna", "బొమ్మలు", "చెక్క", "खिलौने", "लकड़ी", "sculpture"],
        "Blue Pottery": ["pottery", "blue pottery", "bowl", "పాట్టరీ", "జైపూర్", "पॉटरी"],
        "Bidriware": ["bidri", "bidriware", "silver", "బిద్రి", "बीदरी"],
        "Pochampally Ikat": ["ikat", "pochampally", "పోచంపల్లి", "इकत"],
        "Terracotta": ["terracotta", "clay", "మట్టి", "मिट्टी"],
        "Handloom": ["handloom", "shawl", "హ్యాండ్‌లూమ్", "हैंडलूम"]
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
        "products", "craft", "crafts", "artisan", "heritage", "gi"
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
            async with httpx.AsyncClient(timeout=3.0) as client:
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


async def generate_buyer_explanation(
    user_message: str,
    language: str,
    product_titles: list,
    match_count: int,
    is_fallback: bool
) -> str:
    """
    Generates natural language response explaining recommendations.
    Uses Gemini LLM when available, or returns precise, honest localized fallback templates.
    Strictly avoids claiming false GI certification on unverified fallback items.
    """
    lang = (language or "te").lower()

    if GEMINI_API_KEY:
        try:
            prompt = f"""
            You are Artisan AI's buyer copilot.
            User query: "{user_message}". Language code: {lang}.
            Number of matching products found: {match_count}.
            Is fallback recommendation (no exact match): {is_fallback}.
            Product titles: {product_titles[:4]}.

            Instruction:
            Write a 1-2 sentence warm response in language '{lang}'.
            If is_fallback is True: You MUST explicitly state that exact matches were not found, but these popular alternative artisan products are available.
            CRITICAL SAFETY RULE: Do NOT claim products are certified GI heritage crafts unless explicitly stated.
            """
            models_to_try = get_models_to_try()
            async with httpx.AsyncClient(timeout=3.0) as client:
                for model in models_to_try:
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

    # Honest localized fallback responses
    if is_fallback:
        if lang == "te":
            return "మీరు వెతికిన వివరాలకు లైవ్‌లో సరిపోలే ఉత్పత్తులు దొరకలేదు. అయితే, మా మార్కెట్‌ప్లేస్‌లోని ఈ ఇతర ప్రసిద్ధ కళాకారుల ఉత్పత్తులు ఇవిగోండి:"
        elif lang == "hi":
            return "आपकी खोज के लिए कोई सटीक उत्पाद नहीं मिला। हालाँकि, हमारे बाज़ार के ये अन्य लोकप्रिय हस्तशिल्प उत्पाद आपको पसंद आ सकते हैं:"
        elif lang == "ta":
            return "உங்கள் தேடலுக்கு நேரடி முடிவுகள் கிடைக்கவில்லை. இருப்பினும், எங்கள் சந்தையில் உள்ள இந்த பிரபல கைவினைப்பொருட்கள் உங்களுக்கு பிடிக்கலாம்:"
        elif lang == "bn":
            return "আপনার অনুসন্ধানের জন্য কোনো হুবহু পণ্য পাওয়া যায়নি। তবে আমাদের মার্কেটপ্লেসের এই অন্যান্য জনপ্রিয় কারিগর সামগ্রীগুলি আপনার পছন্দ হতে পারে:"
        else:
            return "No exact matches were found for your query. Here are some other popular artisan products you may like:"
    else:
        if lang == "te":
            return f"అభివందనాలు! మీ శోధన ('{user_message}') ప్రకారం లైవ్ మార్కెట్‌ప్లేస్‌లో శోధించాను. ఇక్కడ మీకోసం {match_count} అథెంటిక్ చేతివృత్తుల కళారూపాలు లభించాయి:"
        elif lang == "hi":
            return f"नमस्ते! आपकी खोज ('{user_message}') के अनुसार लाइव मार्केटप्लेस में {match_count} प्रामाणिक हस्तशिल्प उत्पाद मिले हैं:"
        elif lang == "ta":
            return f"வணக்கம்! உங்கள் தேடலின் படி ({match_count}) நேரலை கைவினைப்பொருட்கள் கண்டறியப்பட்டுள்ளன:"
        elif lang == "bn":
            return f"নমস্কার! আপনার অনুসন্ধান অনুযায়ী ({match_count}) কারিগর সামগ্রী পাওয়া গেছে:"
        else:
            return f"Hello! I searched our live database for '{user_message}'. Here are {match_count} authentic master artisan crafts matching your query:"

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
    target_name = lang_names.get(target_language, "English")

    if GEMINI_API_KEY:
        try:
            prompt = f"""
            You are a expert translator for traditional Indian artisan crafts.
            Translate the following product information into {target_name} ({target_language}).
            Preserve craft technical terms and traditional artisan style.

            Title: "{title or ''}"
            Description: "{description or ''}"
            Craft Story: "{craft_story or ''}"

            Return a valid JSON object with:
            - title: Translated title in {target_name}
            - description: Translated description in {target_name}
            - craft_story: Translated craft story in {target_name}
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
                            return {
                                "title": parsed.get("title") or title,
                                "description": parsed.get("description") or description,
                                "craft_story": parsed.get("craft_story") or craft_story,
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


CATEGORY_MARKET_BENCHMARKS = {
    "Kalamkari": {"suggested": Decimal("2400.00"), "min": Decimal("1800.00")},
    "Wooden Toys": {"suggested": Decimal("1250.00"), "min": Decimal("850.00")},
    "Blue Pottery": {"suggested": Decimal("950.00"), "min": Decimal("650.00")},
    "Bidriware": {"suggested": Decimal("2800.00"), "min": Decimal("2000.00")},
    "Pochampally Ikat": {"suggested": Decimal("3200.00"), "min": Decimal("2200.00")},
    "Terracotta": {"suggested": Decimal("650.00"), "min": Decimal("450.00")},
    "Handloom": {"suggested": Decimal("2200.00"), "min": Decimal("1500.00")},
    "Other": {"suggested": Decimal("1500.00"), "min": Decimal("1000.00")},
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

    # Benchmark fallback if AI call is unavailable
    matched_benchmark = None
    for cat_key, bench in CATEGORY_MARKET_BENCHMARKS.items():
        if cat_key.lower() in clean_cat.lower() or cat_key.lower() in clean_title.lower():
            matched_benchmark = bench
            break
    if not matched_benchmark:
        matched_benchmark = CATEGORY_MARKET_BENCHMARKS.get("Other", {"suggested": Decimal("1500.00"), "min": Decimal("1000.00")})

    return {
        "suggested_price": matched_benchmark["suggested"],
        "min_fair_price": matched_benchmark["min"],
        "pricing_source": "MARKET_CATEGORY_BENCHMARK",
        "reasoning": f"Fair price estimated based on similar market products in {clean_cat} category."
    }
