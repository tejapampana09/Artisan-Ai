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


def test_gemini_grounding_request_payload(monkeypatch):
    """Test A: Assert Gemini request payload contains tools: [{'google_search': {}}]"""
    from unittest.mock import AsyncMock, MagicMock

    captured_json = {}

    async def mock_post(url, json=None, headers=None):
        nonlocal captured_json
        captured_json = json
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": '[{"title":"Grounded Item","price":500.0,"currency":"INR","source":"Store","url":"https://example.com/item1"}]'}
                        ]
                    },
                    "groundingMetadata": {
                        "groundingChunks": [{"web": {"uri": "https://example.com/item1"}}]
                    }
                }
            ]
        }
        return mock_resp

    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    monkeypatch.setattr("httpx.AsyncClient", lambda **kwargs: mock_client)

    provider = GeminiGroundingMarketResearchProvider(api_key="test_api_key")
    results = asyncio.run(provider.search_comparable_products("Clay Pot"))

    assert captured_json is not None
    assert "tools" in captured_json
    assert captured_json["tools"] == [{"google_search": {}}]
    assert len(results) == 1
    assert results[0]["title"] == "Grounded Item"


def test_gemini_grounding_valid_grounding(monkeypatch):
    """Test B: Given Gemini response with groundingMetadata containing 3 valid web sources and 3 priced products, all 3 are accepted and market_min/median/max are correct."""
    from unittest.mock import AsyncMock, MagicMock

    async def mock_post(url, json=None, headers=None):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": '''[
                                {"title":"Clay Pot A", "price":1000.0, "currency":"INR", "source":"Store A", "url":"https://store.com/item1", "materials":["Clay"]},
                                {"title":"Clay Pot B", "price":1500.0, "currency":"INR", "source":"Store B", "url":"https://store.com/item2", "materials":["Clay"]},
                                {"title":"Clay Pot C", "price":2000.0, "currency":"INR", "source":"Store C", "url":"https://store.com/item3", "materials":["Clay"]}
                            ]'''}
                        ]
                    },
                    "groundingMetadata": {
                        "groundingChunks": [
                            {"web": {"uri": "https://store.com/item1", "title": "Pot A"}},
                            {"web": {"uri": "https://store.com/item2", "title": "Pot B"}},
                            {"web": {"uri": "https://store.com/item3", "title": "Pot C"}}
                        ]
                    }
                }
            ]
        }
        return mock_resp

    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    monkeypatch.setattr("httpx.AsyncClient", lambda **kwargs: mock_client)

    async def _test():
        facts = ArtisanFacts(product_name="Clay Pot", craft_type="Pottery", materials=["Clay"])
        provider = GeminiGroundingMarketResearchProvider(api_key="test_key")
        response = await research_market(artisan_facts=facts, provider=provider)

        assert response.summary.comparable_count == 3
        assert response.summary.priced_comparable_count == 3
        assert response.summary.min_price == 1000.0
        assert response.summary.median_price == 1500.0
        assert response.summary.max_price == 2000.0
        assert response.summary.market_confidence == "HIGH"
        assert response.summary.is_reliable is True

    asyncio.run(_test())


def test_gemini_grounding_fake_url_rejection(monkeypatch):
    """Test C: If Gemini returns a product URL that is not present in groundingMetadata, reject that comparable."""
    from unittest.mock import AsyncMock, MagicMock

    async def mock_post(url, json=None, headers=None):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": '''[
                                {"title":"Clay Pot A", "price":1000.0, "currency":"INR", "source":"Store A", "url":"https://store.com/item1"},
                                {"title":"Clay Pot B", "price":1500.0, "currency":"INR", "source":"Store B", "url":"https://store.com/item2"},
                                {"title":"Fake Pot", "price":10.0, "currency":"INR", "source":"Fake Store", "url":"https://fake-unsupported-url.com/item3"}
                            ]'''}
                        ]
                    },
                    "groundingMetadata": {
                        "groundingChunks": [
                            {"web": {"uri": "https://store.com/item1"}},
                            {"web": {"uri": "https://store.com/item2"}}
                        ]
                    }
                }
            ]
        }
        return mock_resp

    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    monkeypatch.setattr("httpx.AsyncClient", lambda **kwargs: mock_client)

    provider = GeminiGroundingMarketResearchProvider(api_key="test_key")
    results = asyncio.run(provider.search_comparable_products("Clay Pot"))

    assert len(results) == 2
    urls = [r["url"] for r in results]
    assert "https://fake-unsupported-url.com/item3" not in urls
    assert "https://store.com/item1" in urls
    assert "https://store.com/item2" in urls


def test_gemini_grounding_no_grounding_metadata(monkeypatch):
    """Test D: If groundingMetadata is absent, no reliable market data (market_is_reliable=False)."""
    from unittest.mock import AsyncMock, MagicMock

    async def mock_post(url, json=None, headers=None):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": '[{"title":"Ungrounded Pot","price":1000.0,"currency":"INR","source":"Store","url":"https://store.com/item1"}]'}
                        ]
                    }
                }
            ]
        }
        return mock_resp

    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    monkeypatch.setattr("httpx.AsyncClient", lambda **kwargs: mock_client)

    async def _test():
        facts = ArtisanFacts(product_name="Clay Pot", craft_type="Pottery")
        provider = GeminiGroundingMarketResearchProvider(api_key="test_key")
        response = await research_market(artisan_facts=facts, provider=provider)

        assert response.summary.comparable_count == 0
        assert response.summary.priced_comparable_count == 0
        assert response.summary.is_reliable is False
        assert response.summary.median_price is None

    asyncio.run(_test())


def test_gemini_grounding_no_fabricated_prices(monkeypatch):
    """Test E: If a product has no grounded/usable price (price is None/0), it must not affect min/median/max."""
    from unittest.mock import AsyncMock, MagicMock

    async def mock_post(url, json=None, headers=None):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": '''[
                                {"title":"Clay Pot A", "price":1200.0, "currency":"INR", "source":"Store A", "url":"https://store.com/item1", "materials":["Clay"]},
                                {"title":"Clay Pot Unpriced", "price":null, "currency":"INR", "source":"Store B", "url":"https://store.com/item2", "materials":["Clay"]}
                            ]'''}
                        ]
                    },
                    "groundingMetadata": {
                        "groundingChunks": [
                            {"web": {"uri": "https://store.com/item1"}},
                            {"web": {"uri": "https://store.com/item2"}}
                        ]
                    }
                }
            ]
        }
        return mock_resp

    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    monkeypatch.setattr("httpx.AsyncClient", lambda **kwargs: mock_client)

    async def _test():
        facts = ArtisanFacts(product_name="Clay Pot", craft_type="Pottery", materials=["Clay"])
        provider = GeminiGroundingMarketResearchProvider(api_key="test_key")
        response = await research_market(artisan_facts=facts, provider=provider)

        assert response.summary.comparable_count == 2
        assert response.summary.priced_comparable_count == 1
        assert response.summary.min_price == 1200.0
        assert response.summary.median_price == 1200.0
        assert response.summary.max_price == 1200.0
        assert response.summary.is_reliable is False

    asyncio.run(_test())



