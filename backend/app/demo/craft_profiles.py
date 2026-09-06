"""
Demo Craft Knowledge Base — Strictly Isolated for Development & Demonstrations.

This module contains deterministic sample craft profiles for local testing, automated
conftest suites, and developer demos.

CRITICAL ARCHITECTURAL SAFETY RULE:
This module must NEVER be imported or executed in the production fallback path
(when ENVIRONMENT == 'production' or DEMO_MODE is False).
"""

from typing import Dict, Any, Optional
from decimal import Decimal

DEMO_CRAFT_KNOWLEDGE = {
    "kalamkari": {
        "title": "Heritage Hand-drawn Srikalahasti Kalamkari Silk Dupatta",
        "category": "Kalamkari",
        "materials": "Pure Mulberry Silk, Natural Indigo, Madder Root, Bamboo Pen",
        "description": "Exquisite hand-painted Kalamkari textile art featuring mythological motifs and flowing floral vines, cured in organic milk and river water.",
        "craft_story": "Rooted in Andhra Pradesh's temple traditions, each motif is drawn freehand with a sharp bamboo kalam. The cloth undergoes up to 17 intricate steps of natural dyeing, washing, and sun-curing.",
        "tags": ["Kalamkari", "Handpainted", "Natural Dyes", "Mulberry Silk", "GI Craft", "Sustainable"],
        "suggested_price": Decimal("1350.00"),
        "estimated_cost": {"material": Decimal("480.00"), "labour": Decimal("460.00"), "packaging": Decimal("60.00")},
    },
    "wooden": {
        "title": "Traditional Channapatna Lacquer Wood Stacking Toy Set",
        "category": "Wooden Toys",
        "materials": "Wrightia Tinctoria (Ivory Wood), Natural Lac, Turmeric & Spinach Extracts",
        "description": "Eco-friendly, completely non-toxic traditional Indian wooden stacking toy hand-turned on traditional lathes for safe toddler play.",
        "craft_story": "Originating from Karnataka's Toy Town of Channapatna, this GI-tagged craft utilizes ivory wood that is turned at high speed while colored vegetable lac is friction-applied.",
        "tags": ["Channapatna", "Wooden Toys", "Non-Toxic", "GI Tagged", "Heritage Craft"],
        "suggested_price": Decimal("890.00"),
        "estimated_cost": {"material": Decimal("260.00"), "labour": Decimal("330.00"), "packaging": Decimal("50.00")},
    },
    "pottery": {
        "title": "Jaipur Hand-glazed Cobalt Blue Pottery Decorative Bowl",
        "category": "Blue Pottery",
        "materials": "Ground Quartz, Multani Mitti, Glass, Natural Cobalt Mineral Glaze",
        "description": "Signature Egyptian and Persian inspired low-fire ceramic crafted without clay, adorned with royal blue arabesque flourishes.",
        "craft_story": "Practiced for over two centuries in Jaipur, Rajasthan, this delicate craft requires hand-grinding quartz crystals and natural copper/cobalt oxides before single kiln-firing.",
        "tags": ["Blue Pottery", "Jaipur Art", "Cobalt Glaze", "Handmade Ceramics", "Heritage"],
        "suggested_price": Decimal("1450.00"),
        "estimated_cost": {"material": Decimal("450.00"), "labour": Decimal("550.00"), "packaging": Decimal("100.00")},
    },
    "bidri": {
        "title": "Imperial Bidriware Pure Silver Wire Inlay Decorative Plate",
        "category": "Bidriware",
        "materials": "Zinc-Copper Alloy Base, 99.9% Pure Silver Wire, Fort Mud Oxidation",
        "description": "Striking velvet-black metal craft with lustrous silver wire hand-hammered into engraved floral damascene patterns.",
        "craft_story": "Developed in Bidar during the Bahmani Sultanate, the blackened finish is magically created using a rare mineral-rich soil paste collected exclusively from the Bidar Fort grounds.",
        "tags": ["Bidriware", "Silver Inlay", "GI Tagged", "Imperial Metalcraft", "Bidar"],
        "suggested_price": Decimal("2250.00"),
        "estimated_cost": {"material": Decimal("750.00"), "labour": Decimal("850.00"), "packaging": Decimal("120.00")},
    },
    "default": {
        "title": "Authentic Handcrafted Artisan Heritage Creation",
        "category": "Handloom",
        "materials": "Natural Indigenous Fibres & Organic Vegetable Dyes",
        "description": "Authentic handmade creation produced by generational Indian artisans using sustainable, time-tested traditional techniques.",
        "craft_story": "Carrying forward indigenous artistic traditions passed down through generations, crafted with patience and deep respect for natural materials.",
        "tags": ["Handmade", "Indian Heritage", "Artisan Direct", "Sustainable Craft"],
        "suggested_price": Decimal("1150.00"),
        "estimated_cost": {"material": Decimal("380.00"), "labour": Decimal("420.00"), "packaging": Decimal("50.00")},
    }
}

DEMO_CRAFT_PROFILES = DEMO_CRAFT_KNOWLEDGE

def detect_demo_craft_profile(voice_text: str, category_hint: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Selects a deterministic sample craft profile based on keywords.
    ONLY to be used when DEMO_MODE is explicitly True and ENVIRONMENT != 'production'.
    """
    import os
    env = os.getenv("ENVIRONMENT", "development").lower()
    demo = os.getenv("DEMO_MODE", "true").lower() in ["true", "1", "yes"]
    if env == "production":
        raise RuntimeError("Production safety violation: Demo craft profiles cannot be accessed in production environment.")
    if not demo:
        return None

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
