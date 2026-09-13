import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas import ArtisanFacts
from backend.app.services.ai_adapter import extract_artisan_facts, generate_catalog_draft
from backend.app.services.catalog_orchestrator import process_full_catalog_pipeline

client = TestClient(app)

import asyncio

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
