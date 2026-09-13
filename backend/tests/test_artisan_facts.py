import pytest
from backend.app.schemas import ArtisanFacts
from backend.app.services.ai_adapter import extract_artisan_facts

def test_a_explicit_artisan_facts_creation():
    """Test A: Explicit creation of ArtisanFacts Pydantic model."""
    facts = ArtisanFacts(
        product_name="Kondapalli Wooden Toy",
        craft_type="Wooden Toys",
        materials=["wood", "natural dyes"],
        handmade=True,
        making_time="2 days",
        artisan_story="20 years family tradition",
        special_characteristics="Hand painted"
    )
    assert facts.product_name == "Kondapalli Wooden Toy"
    assert facts.craft_type == "Wooden Toys"
    assert facts.materials == ["wood", "natural dyes"]
    assert facts.handmade is True
    assert facts.making_time == "2 days"
    assert facts.artisan_story == "20 years family tradition"


def test_b_qna_answers_to_artisan_facts():
    """Test B: qna_answers map correctly to ArtisanFacts."""
    qna = {
        "q1_title": "చెక్క బొమ్మ",
        "q2_materials": "చెక్క, సహజ రంగులు",
        "q3_story": "రెండు రోజులు పడుతుంది"
    }
    facts = extract_artisan_facts(qna_answers=qna, category_hint="Wooden Toys")
    assert facts.product_name == "చెక్క బొమ్మ"
    assert facts.craft_type == "Wooden Toys"
    assert facts.materials == ["చెక్క", "సహజ రంగులు"]
    assert facts.artisan_story == "రెండు రోజులు పడుతుంది"


def test_c_legacy_voice_description_fallback():
    """Test C: Legacy voice_description maps to special_characteristics conservatively."""
    facts = extract_artisan_facts(voice_description="handmade wooden bowl", category_hint="Handcrafted")
    assert facts.special_characteristics == "handmade wooden bowl"
    assert facts.product_name == ""
    assert facts.materials == []
    assert facts.handmade is None


def test_d_missing_handmade_stays_none():
    """Test D: When handmade is omitted, it remains None."""
    facts_qna = extract_artisan_facts(qna_answers={"q1_title": "Handmade Clay Pot"})
    assert facts_qna.handmade is None

    facts_dict = extract_artisan_facts(artisan_facts={"product_name": "Terracotta Vases"})
    assert facts_dict.handmade is None


def test_e_missing_materials_stays_empty_list():
    """Test E: Missing materials stays []."""
    facts = extract_artisan_facts(qna_answers={"q1_title": "Handwoven Saris"})
    assert facts.materials == []


def test_f_normalizer_does_not_invent_facts():
    """Test F: Normalizer does not infer materials/craft_type/story from prose text."""
    prose = "Beautiful handmade teak wood artifact crafted over 5 days with ancestral family secret."
    facts = extract_artisan_facts(voice_description=prose)

    # Normalizer MUST NOT guess materials=["teak wood"] or handmade=True or story from prose!
    assert facts.materials == []
    assert facts.handmade is None
    assert facts.artisan_story == ""
    assert facts.product_name == ""
    assert facts.special_characteristics == prose
