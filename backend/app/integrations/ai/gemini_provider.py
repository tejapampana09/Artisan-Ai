import json
import httpx
from typing import Dict, Any, Optional
from decimal import Decimal, ROUND_HALF_UP

from backend.app.integrations.ai.base import BaseAIProvider
from backend.app.config import GEMINI_API_KEY, AI_REQUEST_TIMEOUT_SECONDS

from backend.app.services.ai_adapter import extract_artisan_facts, sanitize_materials, sanitize_craft_story

def calculate_pricing(mat, lab, pkg):
    has_costs = any(c is not None and Decimal(str(c)) > 0 for c in [mat, lab, pkg])
    if not has_costs:
        return None, None, False, "AWAITING_ARTISAN_INPUT"
    m = Decimal(str(mat or 0))
    l = Decimal(str(lab or 0))
    p = Decimal(str(pkg or 0))
    basis = (m + l + p).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    min_fair = (basis * Decimal("1.20")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    suggested = (basis * Decimal("1.40")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return min_fair, suggested, True, "COST_PLUS_MARGIN"

class GeminiAIProvider(BaseAIProvider):
    """
    Google Gemini Multimodal API Implementation.
    Falls back gracefully if key is missing or upstream fails.
    Enforces honest verification: uncertain fields are tagged "Needs artisan confirmation".
    """

    async def generate_catalog_draft(
        self,
        voice_description: str,
        language: str = "en",
        image_url: Optional[str] = None,
        category_hint: Optional[str] = None,
        material_cost: Optional[float] = None,
        labour_cost: Optional[float] = None,
        packaging_cost: Optional[float] = None,
        qna_answers: Optional[Dict[str, str]] = None,
        artisan_facts: Optional[Any] = None
    ) -> Dict[str, Any]:
        clean_desc = (voice_description or "").strip()
        clean_image = (image_url or "").strip()
        clean_cat = (category_hint or "").strip() or None

        artisan_facts_obj = extract_artisan_facts(
            artisan_facts=artisan_facts,
            qna_answers=qna_answers,
            voice_description=clean_desc,
            category_hint=clean_cat
        )
        facts_json_str = json.dumps(artisan_facts_obj.model_dump(), ensure_ascii=False, indent=2)

        min_fair, suggested, pricing_avail, pricing_src = calculate_pricing(
            material_cost, labour_cost, packaging_cost
        )

        if not GEMINI_API_KEY:
            return self._manual_fallback(
                clean_desc, language, clean_image, clean_cat,
                material_cost, labour_cost, packaging_cost,
                min_fair, suggested, pricing_avail, pricing_src
            )

        prompt = f"""You are Artisan AI's master cataloging assistant for traditional Indian handicrafts.
Your task is to generate clean, professional, factual product catalog information based STRICTLY on the artisan's provided inputs.

SOURCE OF TRUTH & STRICT FACTUALITY RULES:
1. CRAFT STORY:
   - Create a polished craft story ONLY from facts explicitly provided by the artisan in Q3 or description.
   - NEVER invent family history, generation count, village/location of origin, awards, GI certification, or cultural claims not explicitly stated by the artisan.
   - If no story/heritage facts were provided, write a simple clean craft summary based strictly on the product description.
2. MATERIALS:
   - Extract ONLY materials explicitly named by the artisan in Q2 or description.
   - NEVER invent specific wood species (e.g. Teak, Rosewood), specific metals, or specific finishes (e.g. natural lacquer) unless explicitly stated.
   - If no materials are mentioned, return an empty array [].
3. PRICING:
   - Do NOT estimate, output, or include any prices, costs, or margins. Pricing is strictly calculated by a separate pricing engine.
4. TITLE & DESCRIPTION:
   - Create a clean, market-ready title (max 10 words) and product overview (2-3 sentences).
5. CATEGORY & TAGS:
   - Select an appropriate category (Kalamkari, Wooden Toys, Blue Pottery, Bidriware, Pochampally Ikat, Terracotta, Handloom, Other) and 4-6 relevant discovery tags.

ARTISAN PRODUCT INFORMATION:
- Target Language: {language}
- Craft Hint: {clean_cat or 'Not specified'}
- Q1 (Product Name & Craft): {q1_val or 'Not provided'}
- Q2 (Materials & Handiwork): {q2_val or 'Not provided'}
- Q3 (Craft Process & Story): {q3_val or 'Not provided'}
- General Voice / Text Description: {clean_desc or 'Not provided'}

Return ONLY valid JSON matching this schema:
{{
  "title": "Clean product title in English",
  "description": "Product overview in English",
  "craft_story": "Factual craft story in English",
  "materials": ["Material 1", "Material 2"],
  "category": "Category Name",
  "tags": ["tag1", "tag2", "tag3"]
}}"""

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [{
                    "parts": [{"text": prompt}]
                }],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json"
                }
            }

            async with httpx.AsyncClient(timeout=AI_REQUEST_TIMEOUT_SECONDS) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                text_content = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text_content)

                raw_mat = parsed.get("materials", [])
                if isinstance(raw_mat, list):
                    mat_list = [str(m).strip() for m in raw_mat if str(m).strip()]
                elif isinstance(raw_mat, str):
                    mat_list = [m.strip() for m in raw_mat.split(",") if m.strip()]
                else:
                    mat_list = []

                return {
                    "source": "LIVE_AI",
                    "is_live_ai": True,
                    "is_demo_data": False,
                    "requires_artisan_verification": True,
                    "title": parsed.get("title") or q1_val or "Handcrafted Item",
                    "category": parsed.get("category") or clean_cat or "Handcrafted",
                    "materials": ", ".join(mat_list) if mat_list else "Not specified",
                    "description": parsed.get("description") or clean_desc,
                    "craft_story": parsed.get("craft_story") or q3_val or "Traditional artisan craft.",
                    "region_of_origin": "Not specified",
                    "tags": parsed.get("tags") or ["handmade", "handicraft"],
                    "suggested_price": suggested,
                    "min_fair_price": min_fair,
                    "material_cost": material_cost,
                    "labour_cost": labour_cost,
                    "packaging_cost": packaging_cost,
                    "min_margin_pct": Decimal("0.20"),
                    "pricing_available": pricing_avail,
                    "pricing_source": pricing_src,
                    "image_url": clean_image,
                    "enhanced_image_url": clean_image,
                    "transcription": clean_desc,
                    "language_detected": language,
                    "lifecycle_state": "AI_GENERATED",
                    "notice": "Draft generated via Gemini AI. Please verify details before publishing."
                }
        except Exception:
            return self._manual_fallback(
                clean_desc, language, clean_image, clean_cat,
                material_cost, labour_cost, packaging_cost,
                min_fair, suggested, pricing_avail, pricing_src
            )

    def _manual_fallback(self, desc, lang, image, cat, mat, lab, pkg, min_fair, suggested, pricing_avail, pricing_src):
        first_line = desc.split("\n")[0].strip() if desc else ""
        title = first_line[:60].strip() if len(first_line) > 3 else f"Handcrafted {cat or 'Item'}"
        return {
            "source": "MANUAL_DRAFT",
            "is_live_ai": False,
            "is_demo_data": False,
            "requires_artisan_verification": True,
            "title": title,
            "category": cat or "Handcrafted",
            "materials": "Needs artisan confirmation",
            "description": desc or "Authentic handmade creation.",
            "craft_story": "Generational traditional technique.",
            "region_of_origin": "Needs artisan confirmation",
            "tags": ["handcrafted", "artisan"],
            "suggested_price": suggested,
            "min_fair_price": min_fair,
            "material_cost": mat,
            "labour_cost": lab,
            "packaging_cost": pkg,
            "min_margin_pct": Decimal("0.20"),
            "pricing_available": pricing_avail,
            "pricing_source": pricing_src,
            "image_url": image,
            "enhanced_image_url": image,
            "transcription": desc,
            "language_detected": lang,
            "lifecycle_state": "AI_GENERATED",
            "notice": "Live AI unavailable. Created manual draft from artisan inputs."
        }
