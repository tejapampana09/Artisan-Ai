import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from backend.app.schemas import (
    ArtisanFacts, MarketProvenance, MarketSearchProfile
)
from backend.app.services.market_page_fetcher import (
    MarketPageFetcher, validate_url_security, SSRFSecurityError
)
from backend.app.services.market_product_extractor import (
    MarketProductExtractor, clean_extracted_price
)
from backend.app.services.market_similarity import (
    calculate_market_similarity,
    build_market_search_profile,
    build_profile_market_query,
    is_hard_relevance_match
)
from backend.app.services.market_research_provider import (
    SearXNGMarketResearchProvider,
    identify_craft_from_image_helper
)
from backend.app.services.market_research import research_market


# ==============================================================================
# 1. SSRF & Network Security Tests
# ==============================================================================

def test_ssrf_rejects_localhost_and_private_ips():
    """Verify SSRF validator blocks localhost, 127.0.0.1, and private networks."""
    # Loopback
    with pytest.raises(SSRFSecurityError):
        validate_url_security("http://localhost:8080/search")

    with pytest.raises(SSRFSecurityError):
        validate_url_security("http://127.0.0.1:8000/api/product")

    # Private IPv4 ranges
    with pytest.raises(SSRFSecurityError):
        validate_url_security("http://10.0.0.5/item")

    with pytest.raises(SSRFSecurityError):
        validate_url_security("https://192.168.1.100/admin")

    with pytest.raises(SSRFSecurityError):
        validate_url_security("http://172.16.0.1/craft")

    # AWS metadata / link-local
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

    # Let initial public URL pass initial security check
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


# ==============================================================================
# 2. Product Page Extraction Tests
# ==============================================================================

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
    # Ambiguous subscription
    assert clean_extracted_price(500.0, "Starts at ₹500 per month") is None
    assert clean_extracted_price(199.0, "Only ₹199/mo") is None
    assert clean_extracted_price(1500.0, "Starting at ₹1,500") is None

    # Price range
    assert clean_extracted_price("999 - 2999") is None
    assert clean_extracted_price("1200–1800") is None

    # Valid prices
    assert clean_extracted_price("₹2,499.00") == 2499.0
    assert clean_extracted_price("INR 1250") == 1250.0
    assert clean_extracted_price(850) == 850.0


# ==============================================================================
# 3. Canonical Search Profile & Hard Relevance Tests
# ==============================================================================

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
    # Ensure filler is absent
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

    # 1. Blog/article URL
    blog_listing = {
        "title": "History of Kalamkari Sarees and How They Are Made",
        "url": "https://textiles.org/blog/history-of-kalamkari",
        "description": "Article explaining the origins of Kalamkari."
    }
    is_rel, reason = is_hard_relevance_match(profile, blog_listing)
    assert is_rel is False
    assert "blog" in reason.lower() or "article" in reason.lower()

    # 2. General category collection page
    category_listing = {
        "title": "Shop All Handcrafted Products and Collections",
        "url": "https://store.in/collections/all",
        "description": "Browse our complete catalog."
    }
    is_rel, reason = is_hard_relevance_match(profile, category_listing)
    assert is_rel is False

    # 3. Severe product archetype mismatch (Saree vs Brass Bell)
    mismatch_listing = {
        "title": "Handcrafted Brass Temple Bell Pooja Diya",
        "url": "https://store.in/products/brass-bell",
        "category": "Metalware"
    }
    is_rel, reason = is_hard_relevance_match(profile, mismatch_listing)
    assert is_rel is False
    assert "mismatch" in reason.lower()

    # 4. Valid product match
    valid_listing = {
        "title": "Handwoven Kalamkari Silk Saree with Blouse Piece",
        "url": "https://indiahandmade.com/products/kalamkari-saree",
        "category": "Sarees"
    }
    is_rel, reason = is_hard_relevance_match(profile, valid_listing)
    assert is_rel is True


# ==============================================================================
# 4. Attribute Comparability (Similarity Engine) Tests
# ==============================================================================

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

    # Unrelated product with only partial token overlap
    unrelated_listing = {
        "title": "Clay Pigeon Shooting Trap Target Set",
        "category": "Sports",
        "materials": ["Clay"],
        "description": "Outdoor clay shooting targets."
    }
    un_score, un_flags, un_tier = calculate_market_similarity(facts, unrelated_listing)
    assert un_score < 0.45
    assert un_flags["matched_product"] is False


# ==============================================================================
# 5. SearXNG Provider Tests & Decoupling from Gemini
# ==============================================================================

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

    # Mock MarketPageFetcher to return mock_html safely
    async def mock_fetch_page(self, url):
        from backend.app.services.market_page_fetcher import FetchedPage
        return FetchedPage(url=url, html=mock_html, status_code=200, success=True)

    monkeypatch.setattr("backend.app.services.market_page_fetcher.MarketPageFetcher.fetch_page", mock_fetch_page)

    async def _test():
        # Initialize provider with api_key=None
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
        # Test with image_url and no Gemini key
        provider = SearXNGMarketResearchProvider(searxng_url="http://localhost:8080", api_key="")
        # Should not raise NameError or any exception
        results = await provider.search_comparable_products(
            "Blue Pottery Vase", limit=5, image_url="https://example.com/vase.jpg"
        )
        assert isinstance(results, list)

    asyncio.run(_test())


# ==============================================================================
# 6. Provenance & Invariants Tests
# ==============================================================================

def test_ai_estimate_and_internal_marketplace_never_set_market_reliable():
    """Verify Market Evidence Invariants: AI estimate and DB products never set market_is_reliable=True."""
    from backend.app.services.catalog_orchestrator import process_full_catalog_pipeline
    from backend.app.services.market_research_provider import NoOpMarketResearchProvider

    # When NoOpMarketResearchProvider is used and no external market data exists
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
        # Invariant checks:
        assert market_summary.get("is_reliable") is False
        # If median price is present, it must be null/empty unless verified external data existed
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

        # 1. Price recommendation verification
        pricing_rec = draft.get("price_recommendation") or {}
        assert pricing_rec.get("demand_factor") == 1.0
        assert pricing_rec.get("pricing_case") == "CASE_1_PRICE_NOT_PROVIDED"

        # Cost basis is 150 + 250 + 50 = 450. With 20% margin: 540.
        assert pricing_rec.get("minimum_fair_price") == 540.0
        assert pricing_rec.get("recommended_price") == 540.0

        # Verify no phantom ML demand reasoning bullets in draft
        reasoning = pricing_rec.get("reasoning", [])
        assert not any("RandomForestRegressor ML Demand" in r for r in reasoning)
        assert not any("ML demand multiplier" in r for r in reasoning)

        # 2. ML Demand info verification: honest pending state
        ml_demand_info = draft.get("ml_demand_info") or {}
        assert ml_demand_info.get("status") == "PENDING_PUBLICATION"
        assert ml_demand_info.get("predicted_demand_score") is None
        assert ml_demand_info.get("demand_level") == "PENDING"
        assert ml_demand_info.get("ml_demand_multiplier") == 1.0
        assert "activates after publication" in ml_demand_info.get("message", "").lower()

    asyncio.run(_test())
