import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.auth import create_access_token
from backend.app.models import User, InterviewSession
import backend.app.database as db_module
from backend.app.services.v2_pricing_engine import V2PricingEngine
from backend.app.services.market_search_provider import WebSearchProvider, InternalMarketplaceProvider

client = TestClient(app)

def get_auth_headers(email="lakshmi@artisanai.in"):
    with db_module.SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            from backend.app.services.auth import get_password_hash
            user = User(
                email=email,
                name="Lakshmi Devi",
                password_hash=get_password_hash("password123"),
                role="SELLER"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        token = create_access_token(data={"sub": str(user.id), "ver": getattr(user, "token_version", 1) or 1})
        return {"Authorization": f"Bearer {token}"}

def test_strict_state_machine_enforcement():
    headers = get_auth_headers()
    # 1. Start session -> status is ACTIVE
    res_start = client.post("/api/interview/start", json={"language": "te", "category_hint": "Handloom Saree"}, headers=headers)
    assert res_start.status_code == 201
    session_id = res_start.json()["id"]

    # 2. Attempt illegal transition: expected-price directly on ACTIVE session MUST return HTTP 400 Bad Request
    res_illegal_expected = client.post(f"/api/interview/{session_id}/expected-price", json={"expected_price": 1500.0}, headers=headers)
    assert res_illegal_expected.status_code == 400
    assert "MARKET_RESEARCH_COMPLETE" in res_illegal_expected.json()["detail"]

    # 3. Attempt illegal transition: publish directly on ACTIVE session MUST return HTTP 400 Bad Request
    res_illegal_pub = client.post(
        f"/api/interview/{session_id}/publish",
        json={"title": "Test Saree", "category": "Saree", "price": 1500.0},
        headers=headers
    )
    assert res_illegal_pub.status_code == 400
    assert "READY_FOR_REVIEW" in res_illegal_pub.json()["detail"]

def test_auditable_pricing_schema_and_cost_floor_available():
    engine = V2PricingEngine()
    
    # Test pricing calculation with ZERO cost inputs
    res_no_cost = engine.calculate_v2_recommendation(
        material_cost=0,
        labour_cost=0,
        artisan_expected_price=1500,
        market_research_result={"median": "1300.00", "market_range": {"min": "1100.00", "max": "1500.00"}}
    )
    
    assert res_no_cost["cost_floor_available"] is False
    assert res_no_cost["cost_floor"] is None
    assert "Cost-based floor unavailable — cost details not provided" in res_no_cost["warnings"]
    assert res_no_cost["recommended_price"] is not None

def test_market_search_provider_provenance_and_insufficient_evidence():
    provider = WebSearchProvider(timeout_seconds=2.0)
    import asyncio
    
    # Query with improbable term
    result = asyncio.run(provider.search_market(query="XyZ999UnfindableNonexistentCraftItem"))
    assert "research_status" in result
    assert result["research_status"] == "INSUFFICIENT_EVIDENCE"
    assert result["evidence_type"] == "LIVE_WEB"
    assert result["evidences"] == []
    assert "Not enough reliable online listings" in result["message"]
