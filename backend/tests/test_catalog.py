import pytest
import asyncio
import base64
import io
import json
from decimal import Decimal
from unittest.mock import patch, AsyncMock
from PIL import Image
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas import ArtisanFacts
from backend.app.services.ai_adapter import extract_artisan_facts, generate_catalog_draft
from backend.app.services.catalog_orchestrator import process_full_catalog_pipeline
from backend.app.services.catalog_validator import validate_catalog_draft, validate_edited_catalog_strictly
from backend.app.services.image_enhancer import (
    enhance_studio_image,
    enhance_image_bytes,
    remove_cluttered_background_fallback
)

client = TestClient(app)


# =====================================================================
# SECTION 1: Catalog Pipeline Tests (From test_catalog_pipeline.py)
# =====================================================================

def test_extract_artisan_facts_from_structured_qna_and_voice():
    """Verify extract_artisan_facts extracts canonical ArtisanFacts without hallucination."""
    qna = {
        "q1_product": "Terracotta Clay Diya Set",
        "q2_materials": "Terracotta, Natural Clay",
        "q3_story": "Handcrafted for Diwali festival by traditional potters"
    }
    facts = extract_artisan_facts(
        qna_answers=qna,
        voice_description="Handmade earthenware diya set",
        category_hint="Pottery"
    )

    assert facts.product_name == "Terracotta Clay Diya Set"
    assert facts.craft_type == "Pottery"
    assert "Terracotta" in facts.materials
    assert "Natural Clay" in facts.materials


def test_generate_catalog_draft_preserves_canonical_facts():
    """Verify generate_catalog_draft locks canonical materials in output."""
    async def _test():
        facts = ArtisanFacts(
            product_name="Bamboo Fruit Basket",
            craft_type="Basketry",
            materials=["Bamboo", "Cane"],
            handmade=True,
            artisan_story="Crafted in Assam"
        )

        draft = await generate_catalog_draft(artisan_facts=facts, category_hint="Basketry")
        assert "Bamboo" in draft["materials"]
        assert "Cane" in draft["materials"]

    asyncio.run(_test())


def test_process_full_catalog_pipeline_end_to_end():
    """Verify process_full_catalog_pipeline returns a unified payload with verified draft."""
    async def _test():
        facts = ArtisanFacts(
            product_name="Kondapalli Wooden Horse",
            craft_type="Toys",
            materials=["Soft Wood", "Vegetable Dyes"],
            handmade=True
        )

        with patch("backend.app.services.catalog_orchestrator.generate_catalog_draft", new_callable=AsyncMock) as mock_draft, \
             patch("backend.app.services.catalog_orchestrator.research_market", new_callable=AsyncMock) as mock_market:
            
            mock_draft.return_value = {
                "title": "Kondapalli Handcrafted Wooden Horse",
                "category": "Toys",
                "materials": "Soft Wood, Vegetable Dyes",
                "description": "Traditional wooden toy horse from Andhra Pradesh",
                "craft_story": "Centuries-old toy making craft",
                "tags": ["wooden", "toy", "kondapalli"],
                "image_url": "https://example.com/horse.jpg"
            }
            
            from backend.app.schemas import MarketResearchResponse, MarketSummary
            mock_market.return_value = MarketResearchResponse(
                query="Kondapalli Wooden Horse",
                provider="MockProvider",
                listings=[],
                summary=MarketSummary(
                    sample_size=3,
                    min_price=400.0,
                    max_price=600.0,
                    median_price=500.0,
                    average_price=500.0,
                    currency="INR"
                )
            )

            pipeline_result = await process_full_catalog_pipeline(
                artisan_facts=facts,
                selling_price=450.0,
                material_cost=150.0,
                labour_cost=100.0
            )

            assert "catalog" in pipeline_result
            assert "artisan_facts" in pipeline_result
            assert "market_summary" in pipeline_result
            assert "price_recommendation" in pipeline_result
            assert pipeline_result["catalog"]["title"] == "Kondapalli Handcrafted Wooden Horse"
            assert pipeline_result["price_recommendation"]["current_price"] == 450.0
            assert pipeline_result["price_recommendation"]["safety_constraints"]["pricing_case"] == "CASE_3_INSIDE_MARKET"

    asyncio.run(_test())


def test_ai_catalog_draft_production_purity():
    """Verify AICatalogDraftResponse structure has zero mock flags in production mode."""
    from backend.app.routes.ai_catalog import AICatalogDraftResponse
    resp = AICatalogDraftResponse(
        source="LIVE_AI",
        is_live_ai=True,
        is_demo_data=False,
        requires_artisan_verification=True,
        title="Test Handcrafted Craft",
        category="Woodwork"
    )
    assert resp.is_demo_data is False
    assert resp.source == "LIVE_AI"
    assert resp.requires_artisan_verification is True


# =====================================================================
# SECTION 2: Image Enhancer Tests (From test_image_enhancer.py)
# =====================================================================

def test_image_enhancer_pipeline_success():
    """Verifies image enhancer pipeline converts raw image to studio lighting enhanced data URI."""
    # Create a small 100x100 test PIL image
    img = Image.new("RGB", (100, 100), color=(200, 100, 50))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    raw_bytes = buffer.getvalue()
    
    # 1. Direct bytes enhancement
    enhanced_bytes = enhance_image_bytes(raw_bytes, backdrop_id="royal_silk")
    assert isinstance(enhanced_bytes, bytes)
    assert len(enhanced_bytes) > 0
    
    # 2. Async data URI enhancement
    data_uri = f"data:image/jpeg;base64,{base64.b64encode(raw_bytes).decode('utf-8')}"
    res_uri, is_enh, msg = asyncio.run(enhance_studio_image(data_uri, backdrop_id="royal_silk"))
    
    assert is_enh is True
    assert res_uri.startswith("data:image/jpeg;base64,")


def test_fallback_corner_sampling():
    """Verifies corner sampling background removal fallback works on PIL images."""
    img = Image.new("RGBA", (100, 100), color=(200, 100, 50, 255))
    res = remove_cluttered_background_fallback(img)
    assert res.mode == "RGBA"
    assert res.size == (100, 100)


def test_image_enhancer_honest_fallback_when_empty():
    """Verifies honest fallback when image is missing or invalid."""
    res_uri, is_enh, msg = asyncio.run(enhance_studio_image(""))
    assert is_enh is False
    assert "No input photo provided" in msg


# =====================================================================
# SECTION 3: Catalog Validator Tests (From test_catalog_validator.py)
# =====================================================================

def test_valid_catalog_passes_semantically():
    facts = ArtisanFacts(
        product_name="Wooden Toy",
        materials=["Wood"],
        artisan_story="I created this item using traditional hand tooling.",
        craft_type="Toys"
    )
    generated = {
        "title": "Wooden Toy",
        "category": "Toys",
        "materials": "Wood",
        "description": "Handcrafted wooden toy.",
        "craft_story": "I created this item using traditional hand tooling.",
        "suggested_price": Decimal("140.00"),
        "min_fair_price": Decimal("120.00")
    }
    validated = validate_catalog_draft(generated, facts)
    assert validated["title"] == "Wooden Toy"
    assert validated["category"] == "Toys"
    assert validated["materials"] == "Wood"
    assert validated["craft_story"] == "I created this item using traditional hand tooling."


def test_invented_material_is_removed():
    facts = ArtisanFacts(
        materials=["Teak Wood"]
    )
    generated = {
        "title": "Teak Bowl",
        "materials": "Teak Wood, Gold Leaf, Natural Lacquer"
    }
    validated = validate_catalog_draft(generated, facts)
    assert "Teak Wood" in validated["materials"]
    assert "Gold Leaf" not in validated["materials"]
    assert "Natural Lacquer" not in validated["materials"]


def test_all_invalid_materials_restores_artisan_facts_materials():
    facts = ArtisanFacts(
        materials=["Bamboo"]
    )
    generated = {
        "title": "Bamboo Basket",
        "materials": "Plastic, Steel, Acrylic"
    }
    validated = validate_catalog_draft(generated, facts)
    assert validated["materials"] == "Bamboo"


def test_empty_materials_facts_results_in_empty_materials():
    facts = ArtisanFacts(
        materials=[]
    )
    generated_str = {
        "title": "Unspecified Craft",
        "materials": "Oak, Mahogany"
    }
    validated_str = validate_catalog_draft(generated_str, facts)
    assert validated_str["materials"] == ""

    generated_list = {
        "title": "Unspecified Craft",
        "materials": ["Oak", "Mahogany"]
    }
    validated_list = validate_catalog_draft(generated_list, facts)
    assert validated_list["materials"] == []


def test_empty_artisan_story_scrubs_fabricated_family_heritage():
    facts = ArtisanFacts(
        artisan_story=""
    )
    generated = {
        "description": "Handmade wooden item.",
        "craft_story": "Crafted over three generations by ancestral artisans of 20 years of family tradition."
    }
    validated = validate_catalog_draft(generated, facts)
    assert "generations" not in validated["craft_story"].lower()
    assert "ancestral" not in validated["craft_story"].lower()
    assert "family tradition" not in validated["craft_story"].lower()


def test_handmade_none_remains_none():
    facts = ArtisanFacts(
        handmade=None
    )
    generated = {
        "handmade": True
    }
    validated = validate_catalog_draft(generated, facts)
    assert validated["handmade"] is None


def test_empty_making_time_clears_invented_duration():
    facts = ArtisanFacts(
        making_time=""
    )
    generated = {
        "making_time": "5 days"
    }
    validated = validate_catalog_draft(generated, facts)
    assert validated["making_time"] == ""


def test_unsupported_awards_certifications_are_sanitized():
    facts = ArtisanFacts(
        special_characteristics="Finely carved finish"
    )
    generated = {
        "title": "GI Tagged Award-Winning Wooden Toy",
        "description": "National Award winning certified authentic handcrafted item."
    }
    validated = validate_catalog_draft(generated, facts)
    assert "GI Tagged" not in validated["title"]
    assert "Award-Winning" not in validated["title"]
    assert "National Award" not in validated["description"]
    assert "certified authentic" not in validated["description"]


def test_explicit_artisan_facts_are_preserved():
    facts = ArtisanFacts(
        product_name="Kondapalli Toy",
        craft_type="Kondapalli Toys",
        artisan_story="Learned from my father over 10 years of family practice.",
        making_time="3 days"
    )
    generated = {
        "category": "Generic Wooden Craft",
        "craft_story": "Learned from my father over 10 years of family practice.",
        "making_time": "3 days"
    }
    validated = validate_catalog_draft(generated, facts)
    assert validated["category"] == "Kondapalli Toys"
    assert validated["making_time"] == "3 days"
    assert "father" in validated["craft_story"]


def test_legacy_flow_without_artisan_facts_passes_intact():
    generated = {
        "title": "Legacy Item",
        "materials": "Brass",
        "craft_story": "Handcrafted artisan item."
    }
    validated = validate_catalog_draft(generated, None)
    assert validated == generated


def test_pricing_output_is_strictly_preserved():
    facts = ArtisanFacts(
        product_name="Sample Item",
        materials=["Wood"]
    )
    generated = {
        "title": "Sample Item",
        "materials": "Wood, Gold",
        "suggested_price": Decimal("140.00"),
        "min_fair_price": Decimal("120.00"),
        "material_cost": Decimal("50.00"),
        "labour_cost": Decimal("40.00"),
        "packaging_cost": Decimal("10.00"),
        "other_cost": Decimal("0.00"),
        "pricing_available": True,
        "pricing_source": "COST_PLUS_MARGIN"
    }
    validated = validate_catalog_draft(generated, facts)
    
    assert validated["suggested_price"] == Decimal("140.00")
    assert validated["min_fair_price"] == Decimal("120.00")
    assert validated["material_cost"] == Decimal("50.00")
    assert validated["labour_cost"] == Decimal("40.00")
    assert validated["packaging_cost"] == Decimal("10.00")
    assert validated["other_cost"] == Decimal("0.00")
    assert validated["pricing_available"] is True
    assert validated["pricing_source"] == "COST_PLUS_MARGIN"


def test_photo_only_upload_preserves_gemini_vision_materials():
    facts = ArtisanFacts(materials=[])
    generated = {
        "title": "Terracotta Pot",
        "category": "Pottery",
        "materials": "Terracotta Clay, Natural Pigments"
    }
    validated = validate_catalog_draft(generated, facts, allow_ai_visual_inference=True)
    assert validated["materials"] == "Terracotta Clay, Natural Pigments"


def test_artisan_provided_materials_remain_strictly_locked():
    facts = ArtisanFacts(materials=["Teak Wood"])
    generated = {
        "title": "Teak Wood Chair",
        "materials": "Teak Wood, Gold Leaf, Synthetic Lacquer"
    }
    validated = validate_catalog_draft(generated, facts, allow_ai_visual_inference=False)
    assert "Teak Wood" in validated["materials"]
    assert "Gold Leaf" not in validated["materials"]
    assert "Synthetic Lacquer" not in validated["materials"]


def test_photo_only_cannot_invent_unverified_heritage_claims():
    facts = ArtisanFacts(artisan_story="")
    generated = {
        "description": "Handmade ceramic vase.",
        "craft_story": "Crafted over 5 generations of family lineage and ancestral tradition."
    }
    validated = validate_catalog_draft(generated, facts, allow_ai_visual_inference=True)
    assert "5 generations" not in validated["craft_story"].lower()
    assert "ancestral" not in validated["craft_story"].lower()


def test_ai_inferred_fields_tagged_for_empty_artisan_facts_object():
    facts = ArtisanFacts()
    generated = {
        "title": "Terracotta Pot",
        "category": "Pottery",
        "materials": "Terracotta Clay",
        "description": "Beautiful handmade clay pot."
    }
    validated = validate_catalog_draft(generated, facts, allow_ai_visual_inference=True)
    assert "ai_inferred_fields" in validated
    assert set(validated["ai_inferred_fields"]) == {"title", "category", "materials", "description"}


def test_strict_publish_validation_accepts_photo_only_ai_materials_from_initial_draft():
    facts = ArtisanFacts(materials=[])
    initial_draft = {"materials": "Terracotta Clay, Natural Pigments"}
    
    edited_catalog = {"materials": "Terracotta Clay"}
    errors = validate_edited_catalog_strictly(edited_catalog, facts, initial_draft=initial_draft)
    assert errors == []


def test_strict_publish_validation_rejects_completely_new_unsupported_materials():
    facts = ArtisanFacts(materials=[])
    initial_draft = {"materials": "Terracotta Clay"}
    
    edited_catalog = {"materials": "Terracotta Clay, Gold Leaf"}
    errors = validate_edited_catalog_strictly(edited_catalog, facts, initial_draft=initial_draft)
    assert len(errors) == 1
    assert "Gold Leaf" in errors[0]


def test_user_input_without_materials_does_not_trust_ai_initial_materials():
    facts = ArtisanFacts(product_name="Wooden Chair", materials=[])
    initial_draft = {"materials": "Teak Wood, Gold Leaf"}
    edited_catalog = {"materials": "Teak Wood"}
    errors = validate_edited_catalog_strictly(edited_catalog, facts, initial_draft=initial_draft)
    assert len(errors) == 1
    assert "not listed in your verified artisan facts" in errors[0] or "No materials were declared" in errors[0]


def test_translation_json_title_and_description_sanitization():
    """Verify draft generation sanitizes forbidden award/GI tags in translations JSON, and publish validation rejects unverified claims."""
    facts = ArtisanFacts(materials=["Clay"], artisan_story="")
    raw_translations = json.dumps({
        "te": {
            "title": "GI Tagged Traditional Craft",
            "description": "National Award winning product",
            "craft_story": "Passed down for generations"
        }
    })
    
    # 1. Draft generation sanitization -> forbidden award/GI tags removed
    generated = {
        "title": "Traditional Craft",
        "description": "Pottery craft",
        "translations": raw_translations
    }
    validated = validate_catalog_draft(generated, facts)
    trans_out = json.loads(validated["translations"])
    assert "gi tag" not in trans_out["te"]["title"].lower()
    assert "national award" not in trans_out["te"]["description"].lower()
    assert "generations" not in trans_out["te"]["craft_story"].lower()

    # 2. Strict publish validation -> rejects unverified claims in translations JSON
    edited_catalog = {
        "title": "Traditional Craft",
        "translations": raw_translations
    }
    errors = validate_edited_catalog_strictly(edited_catalog, facts)
    assert len(errors) > 0
    assert any("translations.te" in err for err in errors)
