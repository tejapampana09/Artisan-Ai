import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.auth import create_access_token
from backend.app.models import User, Product, InterviewSession
from backend.app.database import SessionLocal

client = TestClient(app)

def get_auth_headers(email="lakshmi@artisanai.in"):
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        token = create_access_token(data={"sub": str(user.id), "ver": getattr(user, "token_version", 1) or 1})
        return {"Authorization": f"Bearer {token}"}

def test_start_interview_session():
    headers = get_auth_headers()
    response = client.post(
        "/api/interview/start",
        json={"language": "te", "category_hint": "Kalamkari Silk Saree"},
        headers=headers
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert "id" in data
    assert data["language"] == "te"
    assert data["status"] in ["ACTIVE", "IN_PROGRESS"]
    assert data["current_question"] != ""
    assert data["question_count"] == 1

def test_interview_answer_flow_and_max_5_questions():
    headers = get_auth_headers()
    # 1. Start session
    res_start = client.post(
        "/api/interview/start",
        json={"language": "te", "category_hint": "Wooden Toy"},
        headers=headers
    )
    session_id = res_start.json()["id"]

    # 2. Loop answers
    answers = [
        "ఈ బొమ్మ కొండపల్లి టేకు చెక్కతో చేసాము.",
        "దీని తయారీకి 12 గంటలు పట్టింది.",
        "నైపుణ్యం కలిగిన హస్తకళాకారులు ప్రకృతి సిద్ధమైన రంగులు ఉపయోగించారు.",
        "పరిమాణం 10 ఇంచుల ఎత్తు ఉంటుంది.",
        "ప్రధానంగా పండుగల అలంకరణకు ఉపయోగిస్తారు."
    ]

    final_data = None
    for ans in answers:
        res = client.post(
            f"/api/interview/{session_id}/answer",
            json={"answer": ans},
            headers=headers
        )
        assert res.status_code == 200, res.text
        final_data = res.json()
        if final_data["status"] == "FACTS_COMPLETE":
            break

    assert final_data["question_count"] <= 5
    assert final_data["status"] in ["ACTIVE", "IN_PROGRESS", "FACTS_COMPLETE"]
    assert "product_facts" in final_data

def test_market_research_execution():
    headers = get_auth_headers()
    res_start = client.post("/api/interview/start", json={"language": "en", "category_hint": "Woodwork"}, headers=headers)
    session_id = res_start.json()["id"]
    client.post(f"/api/interview/{session_id}/answer", json={"answer": "Teak wood carved elephant"}, headers=headers)

    # Run market research
    res_mr = client.post(f"/api/interview/{session_id}/market-research", headers=headers)
    assert res_mr.status_code == 200, res_mr.text
    data = res_mr.json()
    assert "market_research_result" in data
    mr = data["market_research_result"]
    assert "market_range" in mr
    assert "median" in mr
    assert mr["median"] > 0
    assert "evidences" in mr
    assert len(mr["evidences"]) > 0

def test_expected_price_and_generate_listing():
    headers = get_auth_headers()
    res_start = client.post("/api/interview/start", json={"language": "te", "category_hint": "Saree"}, headers=headers)
    session_id = res_start.json()["id"]

    # Submit expected price
    res_exp = client.post(
        f"/api/interview/{session_id}/expected-price",
        json={"expected_price": 1200.0},
        headers=headers
    )
    assert res_exp.status_code == 200
    assert res_exp.json()["artisan_expected_price"] == 1200.0

    # Generate listing prose
    res_list = client.post(f"/api/interview/{session_id}/generate-listing", headers=headers)
    assert res_list.status_code == 200, res_list.text
    ld = res_list.json()
    assert "ai_generated_listing" in ld
    draft = ld["ai_generated_listing"]
    assert "title" in draft
    assert "description" in draft
    assert "craft_story" in draft

def test_final_pricing_option_b_cap():
    headers = get_auth_headers()
    res_start = client.post("/api/interview/start", json={"language": "en", "category_hint": "Terracotta"}, headers=headers)
    session_id = res_start.json()["id"]

    # Submit expected price of 2000
    client.post(f"/api/interview/{session_id}/expected-price", json={"expected_price": 2000.0}, headers=headers)

    # Calculate final price with costs
    res_price = client.post(
        f"/api/interview/{session_id}/final-price",
        json={
            "material_cost": 200.0,
            "labour_cost": 200.0,
            "packaging_cost": 50.0,
            "other_cost": 50.0
        },
        headers=headers
    )
    assert res_price.status_code == 200, res_price.text
    pdata = res_price.json()

    assert pdata["recommended_price"] is not None
    assert pdata["recommended_price"] <= 750.0 # Option B +25% cap applied on baseline floor (600 * 1.25 = 750)
    assert len(pdata["pricing_explanation"]) > 0

def test_publish_interview_product():
    headers = get_auth_headers()
    res_start = client.post("/api/interview/start", json={"language": "te", "category_hint": "Brass Lamp"}, headers=headers)
    session_id = res_start.json()["id"]

    # Post answer & expected price
    client.post(f"/api/interview/{session_id}/answer", json={"answer": "Traditional Brass Diya"}, headers=headers)
    client.post(f"/api/interview/{session_id}/expected-price", json={"expected_price": 800.0}, headers=headers)

    # Publish product
    publish_payload = {
        "title": "Handmade Brass Diya Lamp",
        "description": "Authentic brass lamp handcrafted by master artisans.",
        "category": "Home Decor",
        "craft_story": "Generational brass crafting technique.",
        "price": 750.0,
        "image_url": "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800",
        "materials": "Pure Brass",
        "stock": 5
    }

    res_pub = client.post(f"/api/interview/{session_id}/publish", json=publish_payload, headers=headers)
    assert res_pub.status_code in [200, 201], res_pub.text
    prod = res_pub.json()
    assert prod["title"] == "Handmade Brass Diya Lamp"
    assert float(prod["price"]) == 750.0
    assert prod["category"] == "Home Decor"
    assert prod["craft_story"] == "Generational brass crafting technique."

    # Verify session status is PUBLISHED
    res_sess = client.get(f"/api/interview/{session_id}", headers=headers)
    assert res_sess.json()["status"] == "PUBLISHED"
