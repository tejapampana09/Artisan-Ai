import asyncio
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.app.schemas import ArtisanFacts
from backend.app.services.market_research import build_market_query, research_market
from backend.app.services.market_research_provider import MockMarketResearchProvider, NoOpMarketResearchProvider
from backend.app.main import app

client = TestClient(app)

def test_1_query_construction_order():
    facts = ArtisanFacts(
        product_name="Bamboo Basket",
        craft_type="Basketry",
        materials=["Bamboo", "Cane"],
        special_characteristics="Handwoven organic craft finish"
    )
    query = build_market_query(facts)
    assert query == "Bamboo Basket Basketry Bamboo Cane Handwoven organic craft finish"

def test_2_missing_artisan_facts_omitted_from_query():
    facts = ArtisanFacts(
        product_name="Terracotta Jug",
        craft_type="",
        materials=[],
        special_characteristics=""
    )
    query = build_market_query(facts)
    assert query == "Terracotta Jug"

def test_3_provider_results_normalized_and_observed_at_set():
    facts = ArtisanFacts(
        product_name="Bamboo Basket",
        craft_type="Basketry",
        materials=["Bamboo"]
    )
    provider = MockMarketResearchProvider()
    res = asyncio.run(research_market(facts, provider=provider))

    assert len(res.results) > 0
    first = res.results[0]
    assert first.title == "Handmade Bamboo Storage Basket"
    assert first.price == 850.0
    assert first.source == "CraftMarketplace"
    assert first.url == "https://example.com/item/1"
    assert isinstance(first.observed_at, datetime)

def test_4_invalid_zero_negative_prices_excluded_from_statistics():
    facts = ArtisanFacts(
        product_name="Bamboo Basket",
        craft_type="Basketry",
        materials=["Bamboo"]
    )
    custom_mock = [
        {
            "title": "Bamboo Basket A",
            "price": -100.0,
            "currency": "INR",
            "url": "https://example.com/item/a",
            "category": "Basketry",
            "materials": ["Bamboo"]
        },
        {
            "title": "Bamboo Basket B",
            "price": 0.0,
            "currency": "INR",
            "url": "https://example.com/item/b",
            "category": "Basketry",
            "materials": ["Bamboo"]
        },
        {
            "title": "Bamboo Basket C",
            "price": 500.0,
            "currency": "INR",
            "url": "https://example.com/item/c",
            "category": "Basketry",
            "materials": ["Bamboo"]
        }
    ]
    provider = MockMarketResearchProvider(mock_listings=custom_mock)
    res = asyncio.run(research_market(facts, provider=provider))

    assert res.summary.comparable_count == 1
    assert res.summary.min_price == 500.0
    assert res.summary.median_price == 500.0
    assert res.summary.max_price == 500.0

def test_5_listings_without_prices_do_not_affect_statistics():
    facts = ArtisanFacts(
        product_name="Bamboo Basket",
        craft_type="Basketry",
        materials=["Bamboo"]
    )
    custom_mock = [
        {
            "title": "Bamboo Basket A",
            "price": None,
            "currency": "INR",
            "url": "https://example.com/item/a",
            "category": "Basketry",
            "materials": ["Bamboo"]
        },
        {
            "title": "Bamboo Basket B",
            "price": 600.0,
            "currency": "INR",
            "url": "https://example.com/item/b",
            "category": "Basketry",
            "materials": ["Bamboo"]
        },
        {
            "title": "Bamboo Basket C",
            "price": 1000.0,
            "currency": "INR",
            "url": "https://example.com/item/c",
            "category": "Basketry",
            "materials": ["Bamboo"]
        }
    ]
    provider = MockMarketResearchProvider(mock_listings=custom_mock)
    res = asyncio.run(research_market(facts, provider=provider))

    # All 3 listings retained, but only 2 valid prices contributed to summary
    assert len(res.results) == 3
    assert res.summary.comparable_count == 2
    assert res.summary.min_price == 600.0
    assert res.summary.median_price == 800.0
    assert res.summary.max_price == 1000.0

def test_6_correct_min_median_max_statistics():
    facts = ArtisanFacts(
        product_name="Bamboo Basket",
        craft_type="Basketry",
        materials=["Bamboo"]
    )
    custom_mock = [
        {"title": "Bamboo Basket 1", "price": 500.0, "url": "https://e.com/1", "category": "Basketry", "materials": ["Bamboo"]},
        {"title": "Bamboo Basket 2", "price": 700.0, "url": "https://e.com/2", "category": "Basketry", "materials": ["Bamboo"]},
        {"title": "Bamboo Basket 3", "price": 900.0, "url": "https://e.com/3", "category": "Basketry", "materials": ["Bamboo"]},
        {"title": "Bamboo Basket 4", "price": 1000.0, "url": "https://e.com/4", "category": "Basketry", "materials": ["Bamboo"]},
        {"title": "Bamboo Basket 5", "price": 1400.0, "url": "https://e.com/5", "category": "Basketry", "materials": ["Bamboo"]}
    ]
    provider = MockMarketResearchProvider(mock_listings=custom_mock)
    res = asyncio.run(research_market(facts, provider=provider))

    assert res.summary.comparable_count == 5
    assert res.summary.min_price == 500.0
    assert res.summary.median_price == 900.0
    assert res.summary.max_price == 1400.0

def test_7_duplicate_listings_deduplicated():
    facts = ArtisanFacts(
        product_name="Bamboo Basket",
        craft_type="Basketry",
        materials=["Bamboo"]
    )
    duplicate_mock = [
        {"title": "Bamboo Basket A", "price": 500.0, "url": "https://example.com/item/dup", "category": "Basketry", "materials": ["Bamboo"]},
        {"title": "Bamboo Basket A", "price": 500.0, "url": "https://example.com/item/dup", "category": "Basketry", "materials": ["Bamboo"]}
    ]
    provider = MockMarketResearchProvider(mock_listings=duplicate_mock)
    res = asyncio.run(research_market(facts, provider=provider))

    assert len(res.results) == 1
    assert res.summary.comparable_count == 1

def test_8_empty_provider_result_returns_empty_summary_safely():
    facts = ArtisanFacts(
        product_name="Rare Handcrafted Idol",
        craft_type="Sculpture",
        materials=["Bronze"]
    )
    provider = MockMarketResearchProvider(mock_listings=[])
    res = asyncio.run(research_market(facts, provider=provider))

    assert len(res.results) == 0
    assert res.summary.comparable_count == 0
    assert res.summary.min_price is None
    assert res.summary.median_price is None
    assert res.summary.max_price is None

def test_9_artisan_facts_is_never_mutated():
    facts = ArtisanFacts(
        product_name="Bamboo Basket",
        craft_type="Basketry",
        materials=["Bamboo"],
        handmade=True,
        making_time="2 days"
    )
    original_dict = facts.model_dump()
    provider = MockMarketResearchProvider()
    
    asyncio.run(research_market(facts, provider=provider))

    assert facts.model_dump() == original_dict

def test_10_noop_provider_returns_empty_in_production():
    facts = ArtisanFacts(
        product_name="Bamboo Basket",
        craft_type="Basketry",
        materials=["Bamboo"]
    )
    provider = NoOpMarketResearchProvider()
    res = asyncio.run(research_market(facts, provider=provider))

    assert len(res.results) == 0
    assert res.summary.comparable_count == 0
    assert "No live external search provider" in res.notice

def test_11_market_research_api_endpoint():
    payload = {
        "artisan_facts": {
            "product_name": "Bamboo Basket",
            "craft_type": "Basketry",
            "materials": ["Bamboo"],
            "handmade": True,
            "making_time": "2 days",
            "artisan_story": "Handcrafted",
            "special_characteristics": ""
        }
    }
    response = client.post("/api/market/research", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "query" in data
    assert "results" in data
    assert "summary" in data
    assert data["query"] == "Bamboo Basket Basketry Bamboo"
