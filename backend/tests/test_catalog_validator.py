import pytest
from decimal import Decimal
from backend.app.schemas import ArtisanFacts
from backend.app.services.catalog_validator import validate_catalog_draft

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
        "craft_story": "Generational traditional technique."
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
    from backend.app.services.catalog_validator import validate_edited_catalog_strictly
    facts = ArtisanFacts(materials=[])
    initial_draft = {"materials": "Terracotta Clay, Natural Pigments"}
    
    edited_catalog = {"materials": "Terracotta Clay"}
    errors = validate_edited_catalog_strictly(edited_catalog, facts, initial_draft=initial_draft)
    assert errors == []

def test_strict_publish_validation_rejects_completely_new_unsupported_materials():
    from backend.app.services.catalog_validator import validate_edited_catalog_strictly
    facts = ArtisanFacts(materials=[])
    initial_draft = {"materials": "Terracotta Clay"}
    
    edited_catalog = {"materials": "Terracotta Clay, Gold Leaf"}
    errors = validate_edited_catalog_strictly(edited_catalog, facts, initial_draft=initial_draft)
    assert len(errors) == 1
    assert "Gold Leaf" in errors[0]

def test_user_input_without_materials_does_not_trust_ai_initial_materials():
    from backend.app.services.catalog_validator import validate_edited_catalog_strictly
    # Artisan provided product_name in Q&A facts, but omitted materials -> NOT photo-only!
    facts = ArtisanFacts(product_name="Wooden Chair", materials=[])
    initial_draft = {"materials": "Teak Wood, Gold Leaf"}
    
    edited_catalog = {"materials": "Teak Wood"}
    errors = validate_edited_catalog_strictly(edited_catalog, facts, initial_draft=initial_draft)
    assert len(errors) == 1
    assert "not listed in your verified artisan facts" in errors[0] or "No materials were declared" in errors[0]



