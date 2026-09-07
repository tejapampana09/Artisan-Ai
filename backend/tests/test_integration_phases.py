import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.integrations.ai import GeminiAIProvider
from backend.app.integrations.marketplace import InternalMarketplaceAdapter, MockMarketplaceAdapter

client = TestClient(app)

@pytest.fixture
def auth_headers():
    uid = uuid.uuid4().hex[:6]
    email = f"artisan.test.{uid}@artisanai.in"
    reg = client.post("/api/auth/register", json={
        "name": "Integration Test Artisan",
        "email": email,
        "password": "Password123!",
        "role": "ARTISAN"
    })
    token = reg.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_readiness_score_authenticated(auth_headers):
    res = client.get("/api/seller/readiness", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "score" in data
    assert "strengths" in data
    assert "improvements" in data
    assert "next_best_action" in data

def test_sales_channels_list(auth_headers):
    res = client.get("/api/channels/list", headers=auth_headers)
    assert res.status_code == 200
    channels = res.json()
    assert len(channels) >= 3
    ids = [c["id"] for c in channels]
    assert "INTERNAL" in ids
    assert "ONDC_SANDBOX" in ids

def test_sales_channel_publish_mock(auth_headers):
    res = client.post("/api/channels/publish", json={
        "product_id": 1,
        "channel_name": "ONDC_SANDBOX"
    }, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["is_mock"] is True
    assert data["status"] == "SANDBOX_SIMULATED"

def test_ai_provider_abstraction():
    provider = GeminiAIProvider()
    assert hasattr(provider, "generate_catalog_draft")

def test_marketplace_adapter_abstractions():
    internal_adapter = InternalMarketplaceAdapter()
    res1 = internal_adapter.publish_product({"id": 10})
    assert res1["channel"] == "ARTISAN_AI_INTERNAL"

    mock_adapter = MockMarketplaceAdapter("ONDC_SANDBOX")
    res2 = mock_adapter.publish_product({"id": 10})
    assert res2["is_mock"] is True
