import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from backend.app.schemas import (
    ArtisanFacts, MarketProvenance, MarketSearchProfile
)
from backend.app.services.market_research import research_market
from backend.app.services.market_similarity import (
    calculate_market_similarity,
    build_market_search_profile,
    build_profile_market_query,
    is_hard_relevance_match
)
from backend.app.services.market_research_provider import (
    MockMarketResearchProvider,
    WebSearchMarketResearchProvider,
    GeminiGroundingMarketResearchProvider,
    SearXNGMarketResearchProvider,
    identify_craft_from_image_helper,
    _verify_price_in_evidence
)
from backend.app.services.market_page_fetcher import (
    MarketPageFetcher, validate_url_security, SSRFSecurityError
)
from backend.app.services.market_product_extractor import (
    MarketProductExtractor, clean_extracted_price
)


# ==============================================================================
# SECTION 1: Core Market Research & Similarity Tests
# ==============================================================================

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
    login_res = client.post("/api/studio/auth/login", json={
        "email_or_phone": "lakshmi@artisanai.in",
        "password": "ArtisanPass123!"
    })
    token = login_res.json()["access_token"]
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
    captured_json = []

    async def mock_post(url, json=None, headers=None):
        captured_json.append(json)
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

    assert len(captured_json) == 2
    assert captured_json[0]["tools"] == [{"google_search": {}}]
    assert "responseMimeType" not in captured_json[0]["generationConfig"]
    assert "tools" not in captured_json[1]
    assert captured_json[1]["generationConfig"]["responseMimeType"] == "application/json"
    assert len(results) == 1
    assert results[0]["title"] == "Grounded Item"


def test_gemini_grounding_valid_grounding(monkeypatch):
    """Test B: Given Gemini response with groundingMetadata containing 3 valid web sources and 3 priced products, all 3 are accepted and market_min/median/max are correct."""
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


def test_verify_price_in_evidence_accepted_and_rejected():
    """Verify price evidence rule accepts verified prices and rejects ungrounded/ambiguous prices."""
    # Valid explicit price in snippet/evidence
    assert _verify_price_in_evidence(1299.0, "₹1,299", "Handmade Brass Bell", "Buy online for ₹1,299 with free shipping") is True
    assert _verify_price_in_evidence(850.0, "", "Bamboo Basket Rs 850", "Eco friendly basket") is True

    # Ungrounded price (price digits missing from text)
    assert _verify_price_in_evidence(9999.0, "", "Handmade Bell", "Price around 500 rupees") is False

    # Ambiguous / subscription / starting price phrases
    assert _verify_price_in_evidence(500.0, "Starting at ₹500", "Handmade Bell", "Starting at ₹500 per month") is False
    assert _verify_price_in_evidence(200.0, "₹200/mo", "Craft Subscription", "Only ₹200/mo") is False


def test_searxng_market_research_provider_success(monkeypatch):
    """Verify SearXNGMarketResearchProvider queries SearXNG and extracts verified comparables."""
    searxng_mock_data = {
        "results": [
            {
                "url": "https://www.etsy.com/in-en/listing/101",
                "title": "Handcrafted Brass Bell",
                "content": "Authentic handmade brass temple bell. Price ₹1,500 INR."
            },
            {
                "url": "https://www.amazon.in/dp/B08XYZ123",
                "title": "Traditional Brass Puja Bell",
                "content": "Pure brass bell for home temple. ₹1,200 only."
            }
        ]
    }

    gemini_mock_data = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": '''[
                                {
                                    "source_index": 1,
                                    "title": "Handcrafted Brass Bell",
                                    "price_evidence": "₹1,500",
                                    "price": 1500.0,
                                    "currency": "INR",
                                    "description": "Temple bell",
                                    "category": "Brassware",
                                    "materials": ["Brass"]
                                },
                                {
                                    "source_index": 2,
                                    "title": "Traditional Brass Puja Bell",
                                    "price_evidence": "₹1,200",
                                    "price": 1200.0,
                                    "currency": "INR",
                                    "description": "Puja bell",
                                    "category": "Brassware",
                                    "materials": ["Brass"]
                                }
                            ]'''
                        }
                    ]
                }
            }
        ]
    }

    async def mock_get(url, params=None):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = searxng_mock_data
        return resp

    async def mock_post(url, json=None, headers=None):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = gemini_mock_data
        return resp

    mock_client = AsyncMock()
    mock_client.get = mock_get
    mock_client.post = mock_post
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    monkeypatch.setattr("httpx.AsyncClient", lambda **kwargs: mock_client)

    async def _test():
        provider = SearXNGMarketResearchProvider(searxng_url="http://localhost:8080", api_key="test_key")
        results = await provider.search_comparable_products("Brass Bell", limit=5)

        assert len(results) == 2
        assert results[0]["title"] == "Handcrafted Brass Bell"
        assert results[0]["price"] == 1500.0
        assert results[0]["url"] == "https://www.etsy.com/in-en/listing/101"

        assert results[1]["title"] == "Traditional Brass Puja Bell"
        assert results[1]["price"] == 1200.0
        assert results[1]["url"] == "https://www.amazon.in/dp/B08XYZ123"

    asyncio.run(_test())


def test_searxng_provider_failure_does_not_trigger_web_search(monkeypatch):
    """Verify SearXNG failure fails gracefully with failure_reason and doesn't invoke Gemini Grounding."""
    async def mock_get(url, params=None):
        resp = MagicMock()
        resp.status_code = 500
        return resp

    mock_client = AsyncMock()
    mock_client.get = mock_get
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    monkeypatch.setattr("httpx.AsyncClient", lambda **kwargs: mock_client)

    async def _test():
        provider = SearXNGMarketResearchProvider(searxng_url="http://localhost:8080")
        results = await provider.search_comparable_products("Bamboo Basket", limit=5)

        assert len(results) == 0
        assert provider.last_failure_reason is not None
        assert "500" in provider.last_failure_reason

    asyncio.run(_test())


# ==============================================================================
# SECTION 2: Hardening, SSRF & Provenance Invariant Tests
# ==============================================================================

def test_ssrf_rejects_localhost_and_private_ips():
    """Verify SSRF validator blocks localhost, 127.0.0.1, and private networks."""
    with pytest.raises(SSRFSecurityError):
        validate_url_security("http://localhost:8080/search")

    with pytest.raises(SSRFSecurityError):
        validate_url_security("http://127.0.0.1:8000/api/product")

    with pytest.raises(SSRFSecurityError):
        validate_url_security("http://10.0.0.5/item")

    with pytest.raises(SSRFSecurityError):
        validate_url_security("https://192.168.1.100/admin")

    with pytest.raises(SSRFSecurityError):
        validate_url_security("http://172.16.0.1/craft")

    with pytest.raises(SSRFSecurityError):
        validate_url_security("http://169.254.169.254/latest/meta-data")


def test_ssrf_rejects_unsupported_schemes():
    """Verify SSRF validator rejects non-HTTP/HTTPS schemes."""
    with pytest.raises(SSRFSecurityError):
        validate_url_security("file:///etc/passwd")

    with pytest.raises(SSRFSecurityError):
        validate_url_security("ftp://artisan.org/craft.jpg")

    with pytest.raises(SSRFSecurityError):
        validate_url_security("gopher://artisan.org")


def test_page_fetcher_safe_redirect_blocks_ssrf(monkeypatch):
    """Verify redirect to private IP is caught and rejected."""
    fetcher = MarketPageFetcher(timeout=2.0)

    redirect_resp = MagicMock()
    redirect_resp.status_code = 302
    redirect_resp.headers = {"Location": "http://127.0.0.1:8080/private"}

    class MockStreamContext:
        def __init__(self, resp):
            self.resp = resp
        async def __aenter__(self):
            return self.resp
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    class MockAsyncClient:
        def __init__(self, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        def stream(self, method, url, **kwargs):
            return MockStreamContext(redirect_resp)

    with patch("backend.app.services.market_page_fetcher.validate_url_security") as mock_val:
        def side_effect(url):
            if "127.0.0.1" in url or "localhost" in url:
                raise SSRFSecurityError("Localhost blocked")
            return None
        mock_val.side_effect = side_effect

        monkeypatch.setattr("httpx.AsyncClient", MockAsyncClient)

        async def _test():
            page = await fetcher.fetch_page("https://public-craft-store.in/item")
            assert page.success is False
            assert "SSRF" in (page.error or "") or "Redirect blocked" in (page.error or "")

        asyncio.run(_test())


def test_extract_json_ld_schema_product():
    """Verify Schema.org JSON-LD Product with Offer is extracted with highest priority."""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Kalamkari Hand Painted Silk Saree",
            "description": "Authentic natural dye hand painted silk saree from Andhra Pradesh.",
            "category": "Sarees",
            "material": ["Silk", "Natural Dyes"],
            "image": "https://images.crafts.in/saree1.jpg",
            "offers": {
                "@type": "Offer",
                "price": "4500.00",
                "priceCurrency": "INR",
                "availability": "https://schema.org/InStock"
            }
        }
        </script>
    </head>
    <body><h1>Kalamkari Saree</h1></body>
    </html>
    """
    extracted = MarketProductExtractor.extract_from_html(html, "https://crafts.in/saree")
    assert extracted is not None
    assert extracted.title == "Kalamkari Hand Painted Silk Saree"
    assert extracted.price == 4500.0
    assert extracted.currency == "INR"
    assert extracted.image_url == "https://images.crafts.in/saree1.jpg"
    assert "Silk" in extracted.materials
    assert extracted.extraction_method == "JSON_LD"


def test_extract_json_ld_aggregate_offer():
    """Verify Schema.org JSON-LD with AggregateOffer lowPrice."""
    html = """
    <script type="application/ld+json">
    {
        "@type": "Product",
        "name": "Handcrafted Brass Temple Bell",
        "offers": {
            "@type": "AggregateOffer",
            "lowPrice": "1250",
            "priceCurrency": "INR"
        }
    }
    </script>
    """
    extracted = MarketProductExtractor.extract_from_html(html)
    assert extracted is not None
    assert extracted.title == "Handcrafted Brass Temple Bell"
    assert extracted.price == 1250.0
    assert extracted.currency == "INR"
    assert extracted.extraction_method == "JSON_LD"


def test_extract_opengraph_fallback():
    """Verify OpenGraph fallback when no JSON-LD is present."""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta property="og:title" content="Handcarved Teak Wood Box | Heritage Crafts" />
        <meta property="og:description" content="Traditional floral carved wooden jewelry box." />
        <meta property="og:image" content="https://crafts.in/box.jpg" />
        <meta property="product:price:amount" content="899" />
        <meta property="product:price:currency" content="INR" />
    </head>
    <body></body>
    </html>
    """
    extracted = MarketProductExtractor.extract_from_html(html)
    assert extracted is not None
    assert extracted.title == "Handcarved Teak Wood Box"
    assert extracted.price == 899.0
    assert extracted.currency == "INR"
    assert extracted.extraction_method == "OPEN_GRAPH"


def test_extract_html_fallback():
    """Verify safe visible HTML fallback."""
    html = """
    <!DOCTYPE html>
    <html>
    <head><title>Channapatna Wooden Stacking Rings Toy - Buy Online</title></head>
    <body>
        <h1>Channapatna Wooden Stacking Rings Toy</h1>
        <div class="product-price">₹650.00</div>
    </body>
    </html>
    """
    extracted = MarketProductExtractor.extract_from_html(html)
    assert extracted is not None
    assert "Channapatna Wooden Stacking Rings Toy" in extracted.title
    assert extracted.price == 650.0
    assert extracted.currency == "INR"
    assert extracted.extraction_method == "HTML_FALLBACK"


def test_price_cleaning_rejects_ambiguous_and_ranges():
    """Verify price cleaner rejects subscription, ranges, and ungrounded strings."""
    assert clean_extracted_price(500.0, "Starts at ₹500 per month") is None
    assert clean_extracted_price(199.0, "Only ₹199/mo") is None
    assert clean_extracted_price(1500.0, "Starting at ₹1,500") is None

    assert clean_extracted_price("999 - 2999") is None
    assert clean_extracted_price("1200–1800") is None

    assert clean_extracted_price("₹2,499.00") == 2499.0
    assert clean_extracted_price("INR 1250") == 1250.0
    assert clean_extracted_price(850) == 850.0


def test_canonical_market_search_profile_construction():
    """Verify MarketSearchProfile extracts clean keywords without conversational filler."""
    facts = ArtisanFacts(
        product_name="This is an authentic Mangalagiri cotton saree with zari border",
        craft_type="Mangalagiri Handloom",
        materials=["Cotton", "Zari"],
        artisan_story="Handwoven in Andhra Pradesh using traditional pit looms."
    )
    profile = build_market_search_profile(facts)
    assert profile.object_type == "saree"
    assert profile.craft == "Mangalagiri Handloom"
    assert "Cotton" in profile.material
    assert "Andhra" in profile.region or "Andhra Pradesh" in profile.region
    assert "handloom" in profile.technique or "handwoven" in profile.technique

    query = build_profile_market_query(profile)
    assert "this is an authentic" not in query.lower()
    assert "saree" in query.lower()
    assert "mangalagiri" in query.lower()
    assert "buy online india" in query.lower()


def test_hard_relevance_filtering_rejects_blogs_and_mismatches():
    """Verify hard relevance filter rejects blogs, directory pages, and mismatched products."""
    facts = ArtisanFacts(
        product_name="Kalamkari Silk Saree",
        craft_type="Saree",
        materials=["Silk"]
    )
    profile = build_market_search_profile(facts)

    blog_listing = {
        "title": "History of Kalamkari Sarees and How They Are Made",
        "url": "https://textiles.org/blog/history-of-kalamkari",
        "description": "Article explaining the origins of Kalamkari."
    }
    is_rel, reason = is_hard_relevance_match(profile, blog_listing)
    assert is_rel is False
    assert "blog" in reason.lower() or "article" in reason.lower()

    category_listing = {
        "title": "Shop All Handcrafted Products and Collections",
        "url": "https://store.in/collections/all",
        "description": "Browse our complete catalog."
    }
    is_rel, reason = is_hard_relevance_match(profile, category_listing)
    assert is_rel is False

    mismatch_listing = {
        "title": "Handcrafted Brass Temple Bell Pooja Diya",
        "url": "https://store.in/products/brass-bell",
        "category": "Metalware"
    }
    is_rel, reason = is_hard_relevance_match(profile, mismatch_listing)
    assert is_rel is False
    assert "mismatch" in reason.lower()

    valid_listing = {
        "title": "Handwoven Kalamkari Silk Saree with Blouse Piece",
        "url": "https://indiahandmade.com/products/kalamkari-saree",
        "category": "Sarees"
    }
    is_rel, reason = is_hard_relevance_match(profile, valid_listing)
    assert is_rel is True


def test_attribute_comparability_scoring_and_reasons():
    """Verify attribute comparability scoring assigns correct tiers and match reasons."""
    facts = ArtisanFacts(
        product_name="Terracotta Flower Vase",
        craft_type="Pottery",
        materials=["Clay", "Terracotta"],
        artisan_story="Handmade pottery crafted on a traditional potter's wheel."
    )

    matching_listing = {
        "title": "Handcrafted Terracotta Flower Vase",
        "category": "Pottery",
        "materials": ["Terracotta", "Clay"],
        "description": "Earthen clay flower vase for home decor."
    }
    score, flags, tier = calculate_market_similarity(facts, matching_listing)
    assert score >= 0.70
    assert tier in ("STRONG", "GOOD")
    assert flags["matched_product"] is True
    assert flags["matched_material"] is True
    assert flags["matched_craft"] is True
    assert len(flags["match_reasons"]) >= 2

    unrelated_listing = {
        "title": "Clay Pigeon Shooting Trap Target Set",
        "category": "Sports",
        "materials": ["Clay"],
        "description": "Outdoor clay shooting targets."
    }
    un_score, un_flags, un_tier = calculate_market_similarity(facts, unrelated_listing)
    assert un_score < 0.45
    assert un_flags["matched_product"] is False


def test_searxng_provider_executes_without_gemini_key(monkeypatch):
    """Verify SearXNG provider fetches pages and extracts comparables with no Gemini API key."""
    searxng_mock_data = {
        "results": [
            {
                "url": "https://indiahandmade.com/item/101",
                "title": "Handloom Cotton Saree",
                "content": "Authentic cotton saree. Buy for ₹1,800 INR."
            }
        ]
    }

    mock_html = """
    <script type="application/ld+json">
    {
        "@type": "Product",
        "name": "Handloom Cotton Saree",
        "offers": {
            "@type": "Offer",
            "price": "1800",
            "priceCurrency": "INR"
        }
    }
    </script>
    """

    async def mock_get(url, params=None):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = searxng_mock_data
        return resp

    mock_http_client = AsyncMock()
    mock_http_client.get = mock_get
    mock_http_client.__aenter__.return_value = mock_http_client
    mock_http_client.__aexit__.return_value = None

    monkeypatch.setattr("httpx.AsyncClient", lambda **kwargs: mock_http_client)

    async def mock_fetch_page(self, url):
        from backend.app.services.market_page_fetcher import FetchedPage
        return FetchedPage(url=url, html=mock_html, status_code=200, success=True)

    monkeypatch.setattr("backend.app.services.market_page_fetcher.MarketPageFetcher.fetch_page", mock_fetch_page)

    async def _test():
        provider = SearXNGMarketResearchProvider(searxng_url="http://localhost:8080", api_key="")
        assert provider.api_key == ""

        results = await provider.search_comparable_products("Cotton Saree", limit=5)
        assert len(results) == 1
        assert results[0]["title"] == "Handloom Cotton Saree"
        assert results[0]["price"] == 1800.0
        assert results[0]["page_verified"] is True
        assert results[0]["product_verified"] is True
        assert results[0]["price_verified"] is True
        assert results[0]["extraction_method"] == "JSON_LD"
        assert results[0]["market_source_type"] == MarketProvenance.EXTERNAL_LIVE

    asyncio.run(_test())


def test_searxng_image_search_does_not_raise_nameerror(monkeypatch):
    """Regression test: supplying image_url must never raise NameError or crash SearXNG."""
    searxng_mock_data = {"results": []}

    async def mock_get(url, params=None):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = searxng_mock_data
        return resp

    mock_client = AsyncMock()
    mock_client.get = mock_get
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    monkeypatch.setattr("httpx.AsyncClient", lambda **kwargs: mock_client)

    async def _test():
        provider = SearXNGMarketResearchProvider(searxng_url="http://localhost:8080", api_key="")
        results = await provider.search_comparable_products(
            "Blue Pottery Vase", limit=5, image_url="https://example.com/vase.jpg"
        )
        assert isinstance(results, list)

    asyncio.run(_test())


def test_ai_estimate_and_internal_marketplace_never_set_market_reliable():
    """Verify Market Evidence Invariants: AI estimate and DB products never set market_is_reliable=True."""
    from backend.app.services.catalog_orchestrator import process_full_catalog_pipeline
    from backend.app.services.market_research_provider import NoOpMarketResearchProvider

    async def _test():
        facts = ArtisanFacts(
            product_name="Rare Handloom Dupatta",
            craft_type="Weaving",
            materials=["Silk"]
        )

        draft = await process_full_catalog_pipeline(
            artisan_facts=facts,
            user_id=1,
            db=None,
            provider=NoOpMarketResearchProvider()
        )

        market_summary = draft.get("market_summary") or {}
        assert market_summary.get("is_reliable") is False
        assert market_summary.get("median_price") is None
        assert market_summary.get("min_price") is None
        assert market_summary.get("max_price") is None

    asyncio.run(_test())


def test_catalog_creation_uses_neutral_demand_baseline_and_no_synthetic_events():
    """Verify that new catalog draft creation decouples ML demand and uses neutral demand baseline."""
    from backend.app.services.catalog_orchestrator import process_full_catalog_pipeline
    from backend.app.services.market_research_provider import NoOpMarketResearchProvider

    async def _test():
        facts = ArtisanFacts(
            product_name="Terracotta Clay Cooking Pot",
            craft_type="Pottery",
            materials=["Clay"],
            making_time_hours=4.0
        )

        draft = await process_full_catalog_pipeline(
            artisan_facts=facts,
            material_cost=150.0,
            labour_cost=250.0,
            packaging_cost=50.0,
            user_id=1,
            db=None,
            provider=NoOpMarketResearchProvider()
        )

        pricing_rec = draft.get("price_recommendation") or {}
        assert pricing_rec.get("demand_factor") == 1.0
        assert pricing_rec.get("pricing_case") == "CASE_1_PRICE_NOT_PROVIDED"

        assert pricing_rec.get("minimum_fair_price") == 540.0
        assert pricing_rec.get("recommended_price") == 540.0

        reasoning = pricing_rec.get("reasoning", [])
        assert not any("RandomForestRegressor ML Demand" in r for r in reasoning)
        assert not any("ML demand multiplier" in r for r in reasoning)

        ml_demand_info = draft.get("ml_demand_info") or {}
        assert ml_demand_info.get("status") == "PENDING_PUBLICATION"
        assert ml_demand_info.get("predicted_demand_score") is None
        assert ml_demand_info.get("demand_level") == "PENDING"
        assert ml_demand_info.get("ml_demand_multiplier") == 1.0
        assert "activates after publication" in ml_demand_info.get("message", "").lower()

    asyncio.run(_test())
