import asyncio
import json
from decimal import Decimal
from unittest.mock import patch, MagicMock
import pytest

from backend.app.services.ai_adapter import generate_catalog_draft

def test_v2_telugu_multilingual_mapping():
    """Test 1: When language='te', primary title/description/craft_story return in native language (Telugu)."""
    mock_gemini_response = MagicMock()
    mock_gemini_response.status_code = 200
    mock_gemini_response.json.return_value = {
        "candidates": [{
            "content": {
                "parts": [{
                    "text": json.dumps({
                        "title": "Wooden Toy Statue",
                        "description": "Handcrafted wooden doll painted with non-toxic colors.",
                        "craft_story": "Handcrafted over 2 days in Kondapalli style.",
                        "materials": ["Wood", "Natural Colors"],
                        "category": "Wooden Toys",
                        "tags": ["Wood", "Toy", "Handmade"],
                        "native_title": "హ్యాండ్‌క్రాఫ్టెడ్ చెక్క బొమ్మ",
                        "native_description": "చేతితో రంగులు వేసిన సాంప్రదాయ చెక్క బొమ్మ.",
                        "native_craft_story": "రెండు రోజులలో శ్రద్ధగా తయారు చేసిన హస్తకళ."
                    })
                }]
            }
        }]
    }

    qna_answers = {
        "q1_title": "చెక్క బొమ్మ",
        "q2_materials": "చెక్క, చేతితో రంగులు వేశాను",
        "q3_story": "రెండు రోజులు పడుతుంది"
    }

    with patch("backend.app.services.ai_adapter.GEMINI_API_KEY", "mock-key"), \
         patch("httpx.AsyncClient.post", return_value=mock_gemini_response):
        draft = asyncio.run(generate_catalog_draft(
            voice_description="",
            language="te",
            qna_answers=qna_answers
        ))

        # Check native mapping
        assert draft["title"] == "హ్యాండ్‌క్రాఫ్టెడ్ చెక్క బొమ్మ"
        assert draft["description"] == "చేతితో రంగులు వేసిన సాంప్రదాయ చెక్క బొమ్మ."
        assert draft["craft_story"] == "రెండు రోజులలో శ్రద్ధగా తయారు చేసిన హస్తకళ."

        # Check English translations preserved
        assert draft["title_en"] == "Wooden Toy Statue"
        assert draft["description_en"] == "Handcrafted wooden doll painted with non-toxic colors."
        assert draft["craft_story_en"] == "Handcrafted over 2 days in Kondapalli style."


def test_v2_missing_materials_handling():
    """Test 2: When no materials are named by artisan, materials should return 'Not specified' or empty list, not hallucinated materials."""
    mock_gemini_response = MagicMock()
    mock_gemini_response.status_code = 200
    mock_gemini_response.json.return_value = {
        "candidates": [{
            "content": {
                "parts": [{
                    "text": json.dumps({
                        "title": "Handmade Decorative Bowl",
                        "description": "Artisan handmade bowl created with care.",
                        "craft_story": "Handcrafted over one full day.",
                        "materials": [],
                        "category": "Handcrafted",
                        "tags": ["Handmade", "Bowl"],
                        "native_title": "Handmade Decorative Bowl",
                        "native_description": "Artisan handmade bowl created with care.",
                        "native_craft_story": "Handcrafted over one full day."
                    })
                }]
            }
        }]
    }

    qna_answers = {
        "q1_title": "Handmade bowl",
        "q2_materials": "చేతితో తయారు చేశాను",
        "q3_story": "ఒక రోజు పడుతుంది"
    }

    with patch("backend.app.services.ai_adapter.GEMINI_API_KEY", "mock-key"), \
         patch("httpx.AsyncClient.post", return_value=mock_gemini_response):
        draft = asyncio.run(generate_catalog_draft(
            voice_description="",
            language="en",
            qna_answers=qna_answers
        ))

        assert draft["materials"] == "Not specified"
        assert "ceramic" not in draft["materials"].lower()
        assert "clay" not in draft["materials"].lower()


def test_v2_story_no_hallucination():
    """Test 3: No fabricated family heritage or multi-generational tradition when omitted by artisan."""
    mock_gemini_response = MagicMock()
    mock_gemini_response.status_code = 200
    mock_gemini_response.json.return_value = {
        "candidates": [{
            "content": {
                "parts": [{
                    "text": json.dumps({
                        "title": "Artisan Craft Piece",
                        "description": "Simple handmade craft item.",
                        "craft_story": "Handmade craft piece crafted directly by the artisan.",
                        "materials": ["Wood"],
                        "category": "Handcrafted",
                        "tags": ["Craft", "Handmade"],
                        "native_title": "Artisan Craft Piece",
                        "native_description": "Simple handmade craft item.",
                        "native_craft_story": "Handmade craft piece crafted directly by the artisan."
                    })
                }]
            }
        }]
    }

    qna_answers = {
        "q1_title": "Craft item",
        "q2_materials": "Wood",
        "q3_story": "మా కుటుంబం గురించి ఏమీ చెప్పలేదు"
    }

    with patch("backend.app.services.ai_adapter.GEMINI_API_KEY", "mock-key"), \
         patch("httpx.AsyncClient.post", return_value=mock_gemini_response):
        draft = asyncio.run(generate_catalog_draft(
            voice_description="",
            language="en",
            qna_answers=qna_answers
        ))

        story = draft["craft_story"].lower()
        assert "three generations" not in story
        assert "ancestral" not in story
        assert "centuries-old" not in story
