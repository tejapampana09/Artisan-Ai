import pytest
import asyncio
from backend.app.schemas import ArtisanFacts
from backend.app.services.market_research import research_market
from backend.app.services.market_similarity import calculate_market_similarity
from backend.app.services.market_research_provider import MockMarketResearchProvider, WebSearchMarketResearchProvider, GeminiGroundingMarketResearchProvider

def test_market_similarity_exact_and_unrelated_scoring():
    """Verify calculate_market_similarity scores matched vs unrelated craft listings."""
    facts = ArtisanFacts(
        product_name="Bamboo Basket",
        craft_type="Basketry",
        materials=["Bamboo"]
    )
    exact_listing = {
        "title": "Handwoven Bamboo Basket",
        "category": "Basketry",
        "materials": ["Bamboo"],
        "description": "Natural handmade bamboo basket."
    }
    score, flags, tier = calculate_market_similarity(facts, exact_listing)
    assert score >= 0.80
    assert tier == "STRONG"
    assert flags["matched_product"] is True
    assert flags["matched_material"] is True

    unrelated_listing = {
        "title": "Stainless Steel Kitchen Pot",
        "category": "Cookware",
        "materials": ["Steel"],
        "description": "Heavy duty cooking pot."
    }
    un_score, un_flags, un_tier = calculate_market_similarity(facts, unrelated_listing)
    assert un_score < 0.40


def test_mock_market_research_provider():
    """Verify MockMarketResearchProvider returns deterministic structured candidate listings."""
    async def _test():
        provider = MockMarketResearchProvider()
        results = await provider.search_comparable_products("Bamboo Basket", limit=5)
        assert len(results) > 0
        assert "price" in results[0]
        assert "currency" in results[0]
        assert results[0]["currency"] == "INR"

    asyncio.run(_test())


def test_research_market_orchestration_with_mock_provider():
    """Verify research_market pipeline extracts query, searches, and summarizes median."""
    async def _test():
        facts = ArtisanFacts(
            product_name="Handcrafted Brass Bell",
            craft_type="Brassware",
            materials=["Brass"],
            handmade=True
        )

        mock_provider = MockMarketResearchProvider(mock_listings=[
            {"title": "Handcrafted Brass Bell", "category": "Brassware", "price": 1400.0, "currency": "INR", "source": "Store A"},
            {"title": "Brass Temple Bell", "category": "Brassware", "price": 1600.0, "currency": "INR", "source": "Store B"}
        ])

        response = await research_market(artisan_facts=facts, provider=mock_provider)
        assert response.summary is not None
        assert response.summary.comparable_count == 2
        assert response.summary.median_price == 1500.0
        assert response.summary.min_price == 1400.0
        assert response.summary.max_price == 1600.0
        assert response.summary.currency == "INR"

    asyncio.run(_test())
