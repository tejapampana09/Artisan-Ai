import os
import asyncio
from decimal import Decimal
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.ai_adapter import (
    generate_catalog_draft,
    build_production_manual_draft,
    calculate_pricing_from_costs
)
from backend.app.demo.craft_profiles import (
    detect_demo_craft_profile,
    DEMO_CRAFT_PROFILES
)

client = TestClient(app)


def test_1_live_gemini_success():
    """Live Gemini success produces LIVE_AI, is_live_ai=True, requires_artisan_verification=True."""
    mock_gemini_response = MagicMock()
    mock_gemini_response.status_code = 200
    mock_gemini_response.json.return_value = {
        "candidates": [{
            "content": {
                "parts": [{
                    "text": '''{
                        "title": "Natural Handloom Cotton Sari",
                        "category": "Handloom",
                        "materials": "Pure Handspun Organic Cotton",
                        "description": "Artisan handwoven lightweight cotton sari dyed with natural turmeric.",
                        "craft_story": "Generational handloom weaving tradition from Andhra Pradesh.",
                        "tags": ["Handloom", "OrganicCotton", "Artisan"],
                        "suggested_price": 1600.00
                    }'''
                }]
            }
        }]
    }

    with patch("httpx.AsyncClient.post", return_value=mock_gemini_response):
        draft = asyncio.run(generate_catalog_draft(
            voice_description="Handwoven cotton sari with natural dye",
            language="te",
            image_url="https://example.com/artisan_photo.jpg",
            material_cost=Decimal("400.00"),
            labour_cost=Decimal("500.00"),
            packaging_cost=Decimal("100.00"),
            force_fallback=False
        ))

        assert draft["source"] == "LIVE_AI"
        assert draft["is_live_ai"] is True
        assert draft["requires_artisan_verification"] is True
        assert draft["title"] == "Natural Handloom Cotton Sari"
        assert draft["materials"] == "Pure Handspun Organic Cotton"
        # User entered costs strictly dictate pricing
        assert draft["pricing_available"] is True
        assert draft["min_fair_price"] == Decimal("1200.00")
        assert draft["suggested_price"] == Decimal("1400.00")
        assert draft["pricing_source"] == "COST_PLUS_MARGIN"


def test_2_production_failure_no_hardcoded_profiles():
    """When live AI fails in production, predefined craft profiles must NEVER be used."""
    with patch.dict(os.environ, {"ENVIRONMENT": "production", "DEMO_MODE": "false"}):
        draft = asyncio.run(generate_catalog_draft(
            voice_description="చెన్నపట్న బొమ్మలు చెక్కతో చేసినవి పిల్లలకు సురక్షితం",
            language="te",
            force_fallback=True
        ))

        # Must NOT use Channapatna Wooden Toy demo profile
        assert draft["source"] == "MANUAL_DRAFT"
        assert draft["is_live_ai"] is False
        assert draft.get("is_demo_data", False) is False
        assert "Channapatna Wooden Rolling Toy" not in draft["title"]
        assert "Ivory Wood" not in draft["materials"]


def test_3_production_failure_does_not_invent_materials():
    """Manual draft in production must not invent materials not mentioned by artisan."""
    draft = build_production_manual_draft(
        voice_description="Handmade pottery bowl created on wheel",
        language="en"
    )
    assert draft["source"] == "MANUAL_DRAFT"
    assert draft["materials"] == ""


def test_4_production_failure_does_not_invent_craft_story():
    """Manual draft in production must not invent mythological or historical stories."""
    draft = build_production_manual_draft(
        voice_description="Simple woven mat for sitting",
        language="en"
    )
    assert draft["source"] == "MANUAL_DRAFT"
    assert draft["craft_story"] == ""


def test_5_production_failure_no_fake_pricing_when_costs_omitted():
    """When costs are omitted, suggested_price and min_fair_price must be None, pricing_available False."""
    draft = build_production_manual_draft(
        voice_description="Handcrafted basket made of bamboo",
        language="en",
        material_cost=None,
        labour_cost=None,
        packaging_cost=None
    )
    assert draft["pricing_available"] is False
    assert draft["pricing_source"] == "AWAITING_ARTISAN_INPUT"
    assert draft["suggested_price"] is None
    assert draft["min_fair_price"] is None


def test_6_production_failure_preserves_artisan_description():
    """Original artisan description must be preserved exactly."""
    artisan_input = "ఇది సహజ రంగులతో చేసిన మా స్వంత కళాఖండం. రంగు పోదు."
    draft = build_production_manual_draft(
        voice_description=artisan_input,
        language="te"
    )
    assert draft["description"] == artisan_input
    assert draft["transcription"] == artisan_input


def test_7_production_failure_no_stock_unsplash_photo():
    """Production manual draft must not default to stock photos."""
    draft_no_img = build_production_manual_draft(
        voice_description="Handmade brass bell",
        language="en",
        image_url=None
    )
    assert draft_no_img["image_url"] == ""
    assert "unsplash.com" not in draft_no_img["image_url"]

    # If artisan provided an image URL, keep it
    draft_with_img = build_production_manual_draft(
        voice_description="Handmade brass bell",
        language="en",
        image_url="https://artisan-cloud.org/my-bell.jpg"
    )
    assert draft_with_img["image_url"] == "https://artisan-cloud.org/my-bell.jpg"


def test_8_demo_fallback_strictly_isolated():
    """Demo fallback activates ONLY when DEMO_MODE is true and not in production."""
    with patch.dict(os.environ, {"ENVIRONMENT": "production", "DEMO_MODE": "true"}):
        with pytest.raises(RuntimeError) as exc_info:
            detect_demo_craft_profile("kalamkari silk saree")
        assert "Production safety violation" in str(exc_info.value)

    # In non-production with DEMO_MODE=false, demo profile must not activate
    with patch.dict(os.environ, {"ENVIRONMENT": "development", "DEMO_MODE": "false"}):
        profile = detect_demo_craft_profile("kalamkari silk saree")
        assert profile is None


def test_9_demo_fallback_clearly_labeled():
    """When demo fallback is explicitly enabled in dev, it must be labeled DEMO_FALLBACK."""
    with patch.dict(os.environ, {"ENVIRONMENT": "development", "DEMO_MODE": "true"}):
        draft = asyncio.run(generate_catalog_draft(
            voice_description="kalamkari silk saree",
            language="en",
            force_fallback=True
        ))
        assert draft["source"] == "DEMO_FALLBACK"
        assert draft["is_demo_data"] is True
        assert draft["category"] == "Kalamkari"
        assert "Kalamkari" in draft["title"]


def test_10_cost_based_pricing_uses_decimal_precision():
    """Pricing calculation strictly uses Decimal and enforces 20% margin."""
    min_fair, suggested, avail, src = calculate_pricing_from_costs(
        mat=Decimal("123.45"),
        lab=Decimal("67.89"),
        pkg=Decimal("10.00")
    )
    assert avail is True
    assert src == "COST_PLUS_MARGIN"
    # Cost basis = 123.45 + 67.89 + 10.00 = 201.34
    # min_fair = 201.34 * 1.20 = 241.608 -> 241.61
    # suggested = 201.34 * 1.40 = 281.876 -> 281.88
    assert isinstance(min_fair, Decimal)
    assert isinstance(suggested, Decimal)
    assert min_fair == Decimal("241.61")
    assert suggested == Decimal("281.88")


def test_11_missing_cost_inputs_pricing_contract():
    """When costs are all None, calculate_pricing_from_costs returns None and False."""
    min_fair, suggested, avail, src = calculate_pricing_from_costs(
        mat=None,
        lab=None,
        pkg=None
    )
    assert avail is False
    assert src == "AWAITING_ARTISAN_INPUT"
    assert min_fair is None
    assert suggested is None


def test_12_honest_title_derivation():
    """Title is derived honestly from first line of input or fallback to Craft Draft."""
    draft_with_text = build_production_manual_draft(
        voice_description="Hand carved sheesham wood jewelry box with brass latch\nSecond line details",
        language="en"
    )
    assert draft_with_text["title"] == "Hand carved sheesham wood jewelry box with brass latch"

    draft_empty = build_production_manual_draft(
        voice_description="",
        language="en"
    )
    assert draft_empty["title"] == "Craft Draft (Pending Title)"
