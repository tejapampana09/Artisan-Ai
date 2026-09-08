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



def test_ai_provider_abstraction():
    provider = GeminiAIProvider()
    assert hasattr(provider, "generate_catalog_draft")

def test_marketplace_adapter_abstractions():
    internal_adapter = InternalMarketplaceAdapter()
    res1 = internal_adapter.publish_product({"id": 10})
    assert res1["channel"] == "ARTISAN_AI_INTERNAL"

    mock_adapter = MockMarketplaceAdapter("EXPORT_HUB_SANDBOX")
    res2 = mock_adapter.publish_product({"id": 10})
    assert res2["is_mock"] is True
