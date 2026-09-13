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
            {"title": "Handcrafted Brass Bell", "category": "Brassware", "price": 1400.0, "currency": "INR", "source": "Store A", "url": "https://example.com/item/1"},
            {"title": "Brass Temple Bell", "category": "Brassware", "price": 1600.0, "currency": "INR", "source": "Store B", "url": "https://example.com/item/2"}
        ])

        response = await research_market(artisan_facts=facts, provider=mock_provider)
        assert response.summary is not None
        assert response.summary.comparable_count == 2
        assert response.summary.priced_comparable_count == 2
        assert response.summary.is_reliable is True
        assert response.summary.median_price == 1500.0
        assert response.summary.min_price == 1400.0
        assert response.summary.max_price == 1600.0
        assert response.summary.currency == "INR"

    asyncio.run(_test())


def test_zero_priced_comparables_yields_no_market_recommendation():
    """1. 0 priced comparables -> is_reliable=False, pricing engine ignores market signal."""
    async def _test():
        facts = ArtisanFacts(product_name="Rare Craft")
        mock_provider = MockMarketResearchProvider(mock_listings=[])
        response = await research_market(artisan_facts=facts, provider=mock_provider)
        assert response.summary.priced_comparable_count == 0
        assert response.summary.is_reliable is False
        assert response.summary.median_price is None

        from backend.app.services.pricing_engine import calculate_price_recommendation_from_inputs
        rec = calculate_price_recommendation_from_inputs(
            title="Rare Craft",
            category="Craft",
            current_price=0.0,
            market_median=response.summary.median_price,
            market_is_reliable=response.summary.is_reliable
        )
        assert rec["market_signal_used"] is False
        assert rec["recommended_price"] is None

    asyncio.run(_test())


def test_single_weak_comparable_does_not_trust_median():
    """2. 1 weak/single comparable -> is_reliable=False, pricing engine rejects median."""
    async def _test():
        facts = ArtisanFacts(product_name="Handcrafted Bell", craft_type="Brassware", materials=["Brass"])
        mock_provider = MockMarketResearchProvider(mock_listings=[
            {"title": "Handcrafted Brass Bell", "category": "Brassware", "price": 1200.0, "currency": "INR", "url": "https://example.com/item/1"}
        ])
        response = await research_market(artisan_facts=facts, provider=mock_provider)
        assert response.summary.priced_comparable_count == 1
        assert response.summary.is_reliable is False
        assert response.summary.market_confidence == "LOW"

        from backend.app.services.pricing_engine import calculate_price_recommendation_from_inputs
        rec = calculate_price_recommendation_from_inputs(
            title="Handcrafted Bell",
            category="Brassware",
            current_price=0.0,
            market_median=response.summary.median_price,
            market_is_reliable=response.summary.is_reliable
        )
        assert rec["market_signal_used"] is False
        assert rec["recommended_price"] is None

    asyncio.run(_test())


def test_sufficient_valid_comparables_accepts_median():
    """3. Sufficient valid comparables (>=2) -> is_reliable=True, median accepted for pricing."""
    async def _test():
        facts = ArtisanFacts(product_name="Handcrafted Bell", craft_type="Brassware", materials=["Brass"])
        mock_provider = MockMarketResearchProvider(mock_listings=[
            {"title": "Handcrafted Brass Bell", "category": "Brassware", "price": 1400.0, "currency": "INR", "url": "https://example.com/item/1"},
            {"title": "Brass Temple Bell", "category": "Brassware", "price": 1600.0, "currency": "INR", "url": "https://example.com/item/2"}
        ])
        response = await research_market(artisan_facts=facts, provider=mock_provider)
        assert response.summary.priced_comparable_count == 2
        assert response.summary.is_reliable is True
        assert response.summary.median_price == 1500.0

        from backend.app.services.pricing_engine import calculate_price_recommendation_from_inputs
        rec = calculate_price_recommendation_from_inputs(
            title="Handcrafted Bell",
            category="Brassware",
            current_price=0.0,
            market_median=response.summary.median_price,
            market_is_reliable=response.summary.is_reliable
        )
        assert rec["market_signal_used"] is True
        assert rec["recommended_price"] == 1500.0

    asyncio.run(_test())


def test_invalid_price_or_url_listings_are_excluded():
    """4. Listings with invalid price (<=0) or invalid URL (missing/non-http) are excluded."""
    async def _test():
        facts = ArtisanFacts(product_name="Handcrafted Bell", craft_type="Brassware", materials=["Brass"])
        mock_provider = MockMarketResearchProvider(mock_listings=[
            {"title": "Handcrafted Brass Bell", "category": "Brassware", "price": 1400.0, "currency": "INR", "url": "https://example.com/item/1"},
            {"title": "Brass Temple Bell", "category": "Brassware", "price": 0.0, "currency": "INR", "url": "https://example.com/item/2"},  # invalid price
            {"title": "Brass Prayer Bell", "category": "Brassware", "price": 1800.0, "currency": "INR", "url": "not_a_valid_url"}             # invalid url
        ])
        response = await research_market(artisan_facts=facts, provider=mock_provider)
        # Only 1 listing has both valid URL and price > 0
        assert response.summary.priced_comparable_count == 1
        assert response.summary.is_reliable is False

    asyncio.run(_test())


def test_noop_provider_returns_no_fake_fallback_data():
    """5. NoOp provider returns zero results with no fake fallback data injected."""
    async def _test():
        from backend.app.services.market_research_provider import NoOpMarketResearchProvider
        facts = ArtisanFacts(product_name="Any Item")
        response = await research_market(artisan_facts=facts, provider=NoOpMarketResearchProvider())
        assert len(response.results) == 0
        assert response.summary.comparable_count == 0
    asyncio.run(_test())


def test_market_research_requires_auth_and_rate_limiting():
    """Verify that POST /api/market/research requires authentication and is rate limited (10/min)."""
    import uuid
    from fastapi.testclient import TestClient
    from backend.app.main import app

    client = TestClient(app)

    # 1. Unauthenticated request -> 401 Unauthorized
    unauth_res = client.post("/api/market/research", json={
        "artisan_facts": {
            "product_name": "Test Clay Pot",
            "craft_type": "Pottery"
        }
    })
    assert unauth_res.status_code == 401

    # 2. Authenticated request -> 200 OK
    uid = uuid.uuid4().hex[:6]
    reg = client.post("/api/auth/register", json={
        "name": f"Mkt Seller {uid}",
        "email": f"mkt.{uid}@artisanai.in",
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    auth_res = client.post("/api/market/research", json={
        "artisan_facts": {
            "product_name": "Test Clay Pot",
            "craft_type": "Pottery"
        }
    }, headers=headers)
    assert auth_res.status_code == 200
    assert "summary" in auth_res.json()


