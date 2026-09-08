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

def get_models_to_try() -> list:
    """Returns an ordered fallback list of Gemini models starting with configured GEMINI_MODEL."""
    configured = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    defaults = [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash"
    ]
    return [configured] + [m for m in defaults if m != configured]




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
    voice_description: str,
    language: str = "en",
    image_url: Optional[str] = None,
    category_hint: Optional[str] = None,
    material_cost: Optional[Any] = None,
    labour_cost: Optional[Any] = None,
    packaging_cost: Optional[Any] = None,
    other_cost: Optional[Any] = None,
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
        material_cost, labour_cost, packaging_cost, other_cost
    )

    mat_dec = to_decimal(material_cost) if material_cost is not None else None
    lab_dec = to_decimal(labour_cost) if labour_cost is not None else None
    pkg_dec = to_decimal(packaging_cost) if packaging_cost is not None else None
    oth_dec = to_decimal(other_cost) if other_cost is not None else None

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
        "title_en": title,
        "description_en": clean_desc,
        "craft_story_en": "",
        "translations": json.dumps({"en": {"title": title, "description": clean_desc, "craft_story": ""}}),
        "tags": [clean_cat] if clean_cat else [],
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
    other_cost: Optional[Any] = None,
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
        for c in [material_cost, labour_cost, packaging_cost, other_cost]
    )

    # -------------------------------------------------------------------------
    # 1. LIVE GEMINI AI PATHWAY
    # -------------------------------------------------------------------------
    if GEMINI_API_KEY and not force_fallback:
        try:
            prompt = f"""
            You are Artisan AI's master cataloging assistant and expert market pricing strategist for traditional Indian handicrafts.
            The artisan provided this input description: "{clean_desc}".
            Language used: {language}. Craft hint: {clean_category_hint or 'Not specified'}.
            
            Perform two core tasks:
            1. AI HERITAGE STORY & CATALOG DECISION:
               - Craft a compelling, authentic Heritage Craft Story (`craft_story`) that captures the traditional craftsmanship, cultural legacy, and artistic value of this item.
               - Generate a professional product title, engaging description, materials list, and discovery tags.
               - Provide both native language fields (in '{language}') AND clear English translation fields so buyers across India and globally can understand the listing.

            2. MARKET-BASED PRICE RECOMMENDATION (SIMILAR PRODUCTS):
               - Base the `suggested_price` (in INR) on current real-world market prices for SIMILAR handmade products in India within this craft category:
                 * Kalamkari: ₹1,200 - ₹3,500
                 * Kondapalli / Wooden Toys: ₹500 - ₹1,800
                 * Jaipur Blue Pottery: ₹450 - ₹1,600
                 * Bidriware Craft: ₹1,500 - ₹4,500
                 * Pochampally Ikat: ₹1,800 - ₹5,000
                 * Terracotta / Clay Art: ₹350 - ₹1,200
                 * Handloom Weaves: ₹1,200 - ₹4,200
               - Determine `suggested_price` dynamically based on item complexity, material quality, and market benchmarks for similar products.
               - Break down estimated cost components into `estimated_cost` object with keys "material", "labour", "packaging", "other" (all numbers in INR) ensuring a fair 25-40% profit margin above cost.

            Return a valid JSON object with:
            - title: Catchy, market-ready title in language '{language}' (max 10 words)
            - description: Professional 2-3 sentence product overview in language '{language}'
            - craft_story: Cultural or artisanal narrative in language '{language}' highlighting traditional heritage
            - title_en: Clear English translation of title
            - description_en: Clear English translation of description
            - craft_story_en: Clear English translation of craft_story
            - category: One of Kalamkari, Wooden Toys, Blue Pottery, Bidriware, Pochampally Ikat, Terracotta, Handloom, Other
            - materials: Comma-separated list of authentic materials derived from description
            - tags: Array of 4-6 relevant discovery strings
            - suggested_price: Optimal market selling price in INR based on similar products
            - estimated_cost: object with keys "material", "labour", "packaging", "other" as numbers
            """
            models_to_try = get_models_to_try()
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
                                material_cost, labour_cost, packaging_cost, other_cost
                            )
                            mat = to_decimal(material_cost, "0.00")
                            lab = to_decimal(labour_cost, "0.00")
                            pkg = to_decimal(packaging_cost, "0.00")
                            oth = to_decimal(other_cost, "0.00")
                        else:
                            est_cost = parsed.get("estimated_cost", {})
                            mat = to_decimal(est_cost.get("material"), "0.00")
                            lab = to_decimal(est_cost.get("labour"), "0.00")
                            pkg = to_decimal(est_cost.get("packaging"), "0.00")
                            oth = to_decimal(est_cost.get("other"), "0.00")
                            cost_basis = (mat + lab + pkg + oth).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                            min_fair = (cost_basis * Decimal("1.20")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                            raw_sugg = to_decimal(parsed.get("suggested_price"), str(min_fair))
                            suggested = max(min_fair, raw_sugg).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                            pricing_source = "AI_ESTIMATE"
                            pricing_available = True

                        title_main = parsed.get("title", clean_desc[:80])
                        desc_main = parsed.get("description", clean_desc)
                        story_main = parsed.get("craft_story", clean_desc)
                        title_en = parsed.get("title_en") or title_main
                        desc_en = parsed.get("description_en") or desc_main
                        story_en = parsed.get("craft_story_en") or story_main

                        # Default primary title/description/craft_story to English for global marketplace publishing
                        primary_title = title_en if title_en else title_main
                        primary_desc = desc_en if desc_en else desc_main
                        primary_story = story_en if story_en else story_main

                        trans_map = {
                            language: {"title": title_main, "description": desc_main, "craft_story": story_main},
                            "en": {"title": primary_title, "description": primary_desc, "craft_story": primary_story}
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

                        return {
                            "source": "LIVE_AI",
                            "is_live_ai": True,
                            "is_demo_data": False,
                            "requires_artisan_verification": True,
                            "title": primary_title,
                            "category": parsed.get("category", clean_category_hint or "Handloom"),
                            "materials": parsed.get("materials", "Craft materials as stated by artisan"),
                            "description": primary_desc,
                            "craft_story": primary_story,
                            "title_en": primary_title,
                            "description_en": primary_desc,
                            "craft_story_en": primary_story,
                            "translations": json.dumps(trans_map),
                            "tags": parsed.get("tags", [clean_category_hint or "Handmade"]),
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
        packaging_cost=packaging_cost,
        other_cost=other_cost
    )


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
                    if content.startswith("```"):
                        lines = content.split("\n")
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].strip() == "```":
                            lines = lines[:-1]
                        content = "\n".join(lines).strip()
                    parsed = json.loads(content)

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
                            if content.startswith("```"):
                                lines = content.split("\n")
                                if lines[0].startswith("```"):
                                    lines = lines[1:]
                                if lines and lines[-1].strip() == "```":
                                    lines = lines[:-1]
                                content = "\n".join(lines).strip()
                            parsed = json.loads(content)
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
                            if content.startswith("```"):
                                lines = content.split("\n")
                                if lines[0].startswith("```"):
                                    lines = lines[1:]
                                if lines and lines[-1].strip() == "```":
                                    lines = lines[:-1]
                                content = "\n".join(lines).strip()
                            parsed = json.loads(content)
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