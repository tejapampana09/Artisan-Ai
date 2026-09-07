import json
import httpx
from typing import Dict, Any, Optional
from decimal import Decimal, ROUND_HALF_UP

from backend.app.integrations.ai.base import BaseAIProvider
from backend.app.config import GEMINI_API_KEY, AI_REQUEST_TIMEOUT_SECONDS

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
        packaging_cost: Optional[float] = None
    ) -> Dict[str, Any]:
        clean_desc = (voice_description or "").strip()
        clean_image = (image_url or "").strip()
        clean_cat = (category_hint or "").strip() or None

        min_fair, suggested, pricing_avail, pricing_src = calculate_pricing(
            material_cost, labour_cost, packaging_cost
        )

        if not GEMINI_API_KEY:
            return self._manual_fallback(
                clean_desc, language, clean_image, clean_cat,
                material_cost, labour_cost, packaging_cost,
                min_fair, suggested, pricing_avail, pricing_src
            )

        prompt = f"""You are an expert handicraft business copilot.
Artisan Description ({language}): "{clean_desc}"
Category Hint: "{clean_cat or 'None'}"

Extract structured product JSON with these exact keys:
- title: Short clear title (max 60 chars)
- category: Craft category
- materials: Primary materials used (or "Needs artisan confirmation" if unknown)
- description: Engaging marketplace product summary
- craft_story: Cultural or traditional craft narrative
- tags: Array of 3-5 search keywords
- region_of_origin: Region or village of origin (or "Needs artisan confirmation")

IMPORTANT RULES:
- Never fabricate fake GI status or government certification.
- If region or materials are uncertain, mark as "Needs artisan confirmation".
Respond ONLY with valid JSON."""

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

                return {
                    "source": "LIVE_AI",
                    "is_live_ai": True,
                    "is_demo_data": False,
                    "requires_artisan_verification": True,
                    "title": parsed.get("title") or "Handcrafted Item",
                    "category": parsed.get("category") or clean_cat or "Handcrafted",
                    "materials": parsed.get("materials") or "Needs artisan confirmation",
                    "description": parsed.get("description") or clean_desc,
                    "craft_story": parsed.get("craft_story") or "Traditional artisan craft.",
                    "region_of_origin": parsed.get("region_of_origin") or "Needs artisan confirmation",
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
