from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_buyer_marketplace_events_storage():
    # 1. Fetch an existing product to interact with
    prod_res = client.get("/api/products")
    assert prod_res.status_code == 200
    products = prod_res.json()
    assert len(products) > 0
    target_prod = products[0]
    pid = target_prod["id"]
    category = target_prod["category"]
    initial_stock = target_prod["stock"]

    # 2. Test SEARCH Event
    search_res = client.post("/api/events", json={
        "event_type": "SEARCH",
        "category": "Kalamkari",
        "query": "hand painted silk saree"
    })
    assert search_res.status_code == 201
    assert search_res.json()["event_type"] == "SEARCH"

    # 3. Test VIEW Event
    view_res = client.post("/api/events", json={
        "event_type": "VIEW",
        "product_id": pid
    })
    assert view_res.status_code == 201
    assert view_res.json()["event_type"] == "VIEW"
    assert view_res.json()["category"] == category

    # 4. Test SAVE Event
    save_res = client.post("/api/events", json={
        "event_type": "SAVE",
        "product_id": pid
    })
    assert save_res.status_code == 201
    assert save_res.json()["event_type"] == "SAVE"

    # 5. Test ENQUIRY Event
    enquiry_res = client.post("/api/marketplace/enquire", json={
        "product_id": pid,
        "buyer_name": "Rohan Sharma (Craft Retailer)",
        "buyer_phone": "+91 91234 56789",
        "quantity": 10,
        "message": "Looking for bulk consignment order for Diwali exhibition."
    })
    assert enquiry_res.status_code == 201
    assert enquiry_res.json()["event_type"] == "ENQUIRY"

    # 6. Test ORDER Event & Stock Decrement
    order_res = client.post("/api/marketplace/order", json={
        "product_id": pid,
        "buyer_name": "Anita Verma",
        "quantity": 1,
        "delivery_address": "Indiranagar, Bengaluru, Karnataka"
    })
    assert order_res.status_code == 201
    assert order_res.json()["event_type"] == "ORDER"

    # Verify stock decremented
    updated_prod = client.get(f"/api/products/{pid}").json()
    if initial_stock >= 1:
        assert updated_prod["stock"] == initial_stock - 1

    # 7. Verify all events are actually stored in the DB
    all_events_res = client.get("/api/events")
    assert all_events_res.status_code == 200
    events = all_events_res.json()
    types_found = {e["event_type"] for e in events}
    for expected in ["SEARCH", "VIEW", "SAVE", "ENQUIRY", "ORDER"]:
        assert expected in types_found, f"Expected event type {expected} not found in DB events"

    # 8. Test Trending Endpoint
    trending_res = client.get("/api/marketplace/trending")
    assert trending_res.status_code == 200
    trending = trending_res.json()
    assert len(trending) > 0
