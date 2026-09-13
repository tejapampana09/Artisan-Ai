import pytest
from backend.app.schemas import ArtisanFacts
from backend.app.services.market_similarity import calculate_market_similarity

def test_1_exact_match_scores_strongly():
    facts = ArtisanFacts(
        product_name="Bamboo Basket",
        craft_type="Basketry",
        materials=["Bamboo"]
    )
    listing = {
        "title": "Handwoven Bamboo Basket",
        "category": "Basketry",
        "materials": ["Bamboo"],
        "description": "Natural handmade bamboo basket."
    }
    score, flags, tier = calculate_market_similarity(facts, listing)
    assert score >= 0.80
    assert tier == "STRONG"
    assert flags["matched_product"] is True
    assert flags["matched_material"] is True
    assert flags["matched_craft"] is True

def test_2_material_only_match_scores_lower():
    facts = ArtisanFacts(
        product_name="Bamboo Chair",
        craft_type="Furniture",
        materials=["Bamboo"]
    )
    listing = {
        "title": "Bamboo Wall Hanging Decor",
        "category": "Wall Art",
        "materials": ["Bamboo"],
        "description": "Decorative bamboo wall piece."
    }
    score, flags, tier = calculate_market_similarity(facts, listing)
    assert score < 0.80
    assert flags["matched_material"] is True

def test_3_unrelated_product_scores_low_and_rejected():
    facts = ArtisanFacts(
        product_name="Bamboo Basket",
        craft_type="Basketry",
        materials=["Bamboo"]
    )
    listing = {
        "title": "Stainless Steel Kitchen Pot",
        "category": "Cookware",
        "materials": ["Steel"],
        "description": "Heavy duty cooking pot."
    }
    score, flags, tier = calculate_market_similarity(facts, listing)
    assert score < 0.20
    assert tier == "REJECT"
    assert flags["matched_product"] is False
    assert flags["matched_material"] is False

def test_4_case_and_whitespace_normalization():
    facts = ArtisanFacts(
        product_name="  WOODEN   TOY  ",
        craft_type="Toys",
        materials=[" TEAK WOOD "]
    )
    listing = {
        "title": "wooden toy figurine",
        "category": "toys",
        "materials": ["teak wood"],
        "description": "teak wood toy"
    }
    score, flags, tier = calculate_market_similarity(facts, listing)
    assert score >= 0.80
    assert tier == "STRONG"

def test_5_partial_material_phrase_matching():
    facts = ArtisanFacts(
        product_name="Terracotta Pot",
        craft_type="Pottery",
        materials=["Terracotta Clay"]
    )
    listing = {
        "title": "Earthen Terracotta Clay Water Vessel",
        "category": "Pottery",
        "materials": "Clay, Terracotta",
        "description": "Natural terracotta clay vessel."
    }
    score, flags, tier = calculate_market_similarity(facts, listing)
    assert score >= 0.80
    assert flags["matched_material"] is True
