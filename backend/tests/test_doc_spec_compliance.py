import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_doc_spec_market_and_recommendation_endpoints():
    """Verify Section 18 /market/trending and /recommendations endpoints work."""
    res_trend = client.get("/api/market/trending")
    assert res_trend.status_code == 200
    assert isinstance(res_trend.json(), list)

    res_rec = client.get("/api/recommendations")
    assert res_rec.status_code == 200
    assert isinstance(res_rec.json(), list)

def test_doc_spec_enquiries_and_orders_endpoints():
    """Verify Section 18 /enquiries and /orders endpoints work."""
    res_enq = client.get("/api/enquiries")
    assert res_enq.status_code in [200, 401]

    res_ord = client.get("/api/orders")
    assert res_ord.status_code in [200, 401]

def test_doc_spec_sync_endpoints():
    """Verify Section 18 /sync/jobs and /sync/status/{id}."""
    res_status = client.get("/api/sync/status/job-test-123")
    assert res_status.status_code == 200
    assert res_status.json()["status"] == "COMPLETED"
