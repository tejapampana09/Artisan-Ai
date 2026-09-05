import os
import re
import json
import httpx
from typing import Dict, Any, Optional

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

# Fallback presets keyed by detected keywords or craft category
DEMO_CRAFT_KNOWLEDGE = {
    "kalamkari": {
        "title": "Heritage Hand-drawn Srikalahasti Kalamkari Silk Dupatta",
        "category": "Kalamkari",
        "materials": "Pure Mulberry Silk, Natural Indigo, Madder Root, Bamboo Pen",
        "description": "Exquisite hand-painted Kalamkari textile art featuring mythological motifs and flowing floral vines, cured in organic milk and river water.",
        "craft_story": "Rooted in Andhra Pradesh's temple traditions, each motif is drawn freehand with a sharp bamboo kalam. The cloth undergoes up to 17 intricate steps of natural dyeing, washing, and sun-curing.",
        "tags": ["Kalamkari", "Handpainted", "Natural Dyes", "Mulberry Silk", "GI Craft", "SIH2026"],
        "suggested_price": 1350.0,
        "estimated_cost": {"material": 480.0, "labour": 460.0, "packaging": 60.0},
    },
    "wooden": {
        "title": "Traditional Channapatna Lacquer Wood Stacking Toy Set",
        "category": "Wooden Toys",
        "materials": "Wrightia Tinctoria (Ivory Wood), Natural Lac, Turmeric & Spinach Extracts",
        "description": "Eco-friendly, completely non-toxic traditional Indian wooden stacking toy hand-turned on traditional lathes for safe toddler play.",
        "craft_story": "Originating from Karnataka's Toy Town of Channapatna, this GI-tagged craft utilizes ivory wood that is turned at high speed while colored vegetable lac is friction-applied.",
        "tags": ["Channapatna", "Wooden Toys", "Non-Toxic", "GI Tagged", "Heritage Craft"],
        "suggested_price": 890.0,
        "estimated_cost": {"material": 260.0, "labour": 330.0, "packaging": 50.0},
    },
    "pottery": {
        "title": "Jaipur Hand-glazed Cobalt Blue Pottery Decorative Bowl",
        "category": "Blue Pottery",
        "materials": "Ground Quartz, Multani Mitti, Glass, Natural Cobalt Mineral Glaze",
        "description": "Signature Egyptian and Persian inspired low-fire ceramic crafted without clay, adorned with royal blue arabesque flourishes.",
        "craft_story": "Practiced for over two centuries in Jaipur, Rajasthan, this delicate craft requires hand-grinding quartz crystals and natural copper/cobalt oxides before single kiln-firing.",
        "tags": ["Blue Pottery", "Jaipur Art", "Cobalt Glaze", "Handmade Ceramics", "Heritage"],
        "suggested_price": 1450.0,
        "estimated_cost": {"material": 450.0, "labour": 550.0, "packaging": 100.0},
    },
    "bidri": {
        "title": "Imperial Bidriware Pure Silver Wire Inlay Decorative Plate",
        "category": "Bidriware",
        "materials": "Zinc-Copper Alloy Base, 99.9% Pure Silver Wire, Fort Mud Oxidation",
        "description": "Striking velvet-black metal craft with lustrous silver wire hand-hammered into engraved floral damascene patterns.",
        "craft_story": "Developed in Bidar during the Bahmani Sultanate, the blackened finish is magically created using a rare mineral-rich soil paste collected exclusively from the Bidar Fort grounds.",
        "tags": ["Bidriware", "Silver Inlay", "GI Tagged", "Imperial Metalcraft", "Bidar"],
        "suggested_price": 2250.0,
        "estimated_cost": {"material": 750.0, "labour": 850.0, "packaging": 120.0},
    },
    "default": {
        "title": "Authentic Handcrafted Artisan Heritage Creation",
        "category": "Handloom",
        "materials": "Natural Indigenous Fibres & Organic Vegetable Dyes",
        "description": "Authentic handmade creation produced by generational Indian artisans using sustainable, time-tested traditional techniques.",
        "craft_story": "Carrying forward indigenous artistic traditions passed down through generations, crafted with patience and deep respect for natural materials.",
        "tags": ["Handmade", "Indian Heritage", "Artisan Direct", "Sustainable Craft"],
        "suggested_price": 1150.0,
        "estimated_cost": {"material": 380.0, "labour": 420.0, "packaging": 50.0},
    }
}

def detect_craft_profile(voice_text: str, category_hint: Optional[str] = None) -> Dict[str, Any]:
    text_lower = (voice_text + " " + (category_hint or "")).lower()
    if any(k in text_lower for k in ["kalamkari", "saree", "dupatta", "painting", "చెక్క", "కలంకారి"]):
        return DEMO_CRAFT_KNOWLEDGE["kalamkari"]
    elif any(k in text_lower for k in ["wood", "toy", "horse", "channapatna", "బొమ్మ", "लकड़ी"]):
        return DEMO_CRAFT_KNOWLEDGE["wooden"]
    elif any(k in text_lower for k in ["pottery", "blue", "ceramic", "vase", "bowl", "కుండ", "मिट्टी"]):
        return DEMO_CRAFT_KNOWLEDGE["pottery"]
    elif any(k in text_lower for k in ["bidri", "silver", "metal", "inlay", "ప్లేట్", "బిద్రి"]):
        return DEMO_CRAFT_KNOWLEDGE["bidri"]
    return DEMO_CRAFT_KNOWLEDGE["default"]

def enhance_image_url(image_url: Optional[str]) -> str:
    # Studio lighting / enhanced presentation indicator
    if not image_url:
        return "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80"
    return image_url

async def generate_catalog_draft(
    voice_description: str,
    language: str = "en",
    image_url: Optional[str] = None,
    category_hint: Optional[str] = None,
    material_cost: Optional[float] = None,
    labour_cost: Optional[float] = None,
    packaging_cost: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Multimodal AI Catalog Generation:
    1. If GEMINI_API_KEY is available: calls Gemini Vision/Language API.
    2. If not available or on failure: activates deterministic DEMO FALLBACK.
    Never lets an unavailable API key break the workflow.
    """
    is_live = False
    source = "DEMO FALLBACK"

    if GEMINI_API_KEY:
        try:
            prompt = f"""
            You are Artisan AI's cataloging assistant for traditional Indian artisans.
            Analyze this artisan description: "{voice_description}".
            Language used: {language}. Craft hint: {category_hint or 'Not specified'}.
            Return JSON with:
            - title: Catchy, market-ready title (max 10 words)
            - category: One of Kalamkari, Wooden Toys, Blue Pottery, Bidriware, Pochampally Ikat, Terracotta, Handloom, Other
            - materials: Comma-separated list of authentic materials
            - description: Professional 2-3 sentence product overview
            - craft_story: Rich cultural narrative about technique and artisan heritage (2-3 sentences)
            - tags: Array of 5-6 strings
            - suggested_price: Fair selling price in INR (float)
            - estimated_cost: object with material, labour, packaging
            """
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}",
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                    headers={"Content-Type": "application/json"}
                )
                if res.status_code == 200:
                    data = res.json()
                    content = data["candidates"][0]["content"]["parts"][0]["text"]
                    json_match = re.search(r"\{.*\}", content, re.DOTALL)
                    if json_match:
                        parsed = json.loads(json_match.group(0))
                        parsed["source"] = "LIVE AI"
                        parsed["enhanced_image_url"] = enhance_image_url(image_url)
                        parsed["transcription"] = voice_description
                        return parsed
        except Exception as e:
            print(f"[AI Adapter] Live Gemini call failed ({e}), switching to DEMO FALLBACK.")

    # Deterministic Fallback Flow
    profile = detect_craft_profile(voice_description, category_hint)
    
    # Cost structure calculation
    mat = material_cost if material_cost is not None and material_cost > 0 else profile["estimated_cost"]["material"]
    lab = labour_cost if labour_cost is not None and labour_cost > 0 else profile["estimated_cost"]["labour"]
    pkg = packaging_cost if packaging_cost is not None and packaging_cost > 0 else profile["estimated_cost"]["packaging"]
    
    base_cost = mat + lab + pkg
    min_fair = round(base_cost * 1.20)
    suggested = max(min_fair, profile["suggested_price"])

    return {
        "source": "DEMO FALLBACK",
        "title": profile["title"],
        "category": profile["category"],
        "materials": profile["materials"],
        "description": profile["description"],
        "craft_story": profile["craft_story"],
        "tags": profile["tags"],
        "suggested_price": suggested,
        "material_cost": mat,
        "labour_cost": lab,
        "packaging_cost": pkg,
        "min_margin_pct": 0.20,
        "min_fair_price": min_fair,
        "image_url": image_url or "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80",
        "enhanced_image_url": enhance_image_url(image_url),
        "transcription": voice_description,
        "language_detected": language
    }
