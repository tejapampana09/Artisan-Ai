from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_closed_loop_market_intelligence_scenario():
    # Ensure clean state for dynamic surge testing
    from backend.tests.conftest import TestingSessionLocal as SessionLocal

    from backend.app.models import Event
    db = SessionLocal()
    db.query(Event).filter(Event.category == "Wooden Toys").delete()
    db.commit()
    db.close()

    # 1. Fetch initial demand
    initial_demand_res = client.get("/api/market/demand")
    assert initial_demand_res.status_code == 200
    demands = {d["category"]: d for d in initial_demand_res.json()}
    initial_wooden_pct = demands["Wooden Toys"]["demand_pct"]

    # 2. Simulate Buyer Action: Buyer searches Wooden Toys
    search_res = client.post("/api/events", json={
        "event_type": "SEARCH",
        "category": "Wooden Toys",
        "query": "Channapatna wooden rocking horse"
    })
    assert search_res.status_code == 201

    # Additional buyer engagements (View + Save)
    client.post("/api/events", json={
        "event_type": "VIEW",
        "category": "Wooden Toys",
        "metadata_info": "Buyer inspected Wooden Toys craft detail"
    })
    client.post("/api/events", json={
        "event_type": "SAVE",
        "category": "Wooden Toys",
        "metadata_info": "Buyer saved Wooden Toys craft"
    })

    # 3. Verify Demand Score Updates dynamically (not hardcoded)
    updated_demand_res = client.get("/api/market/demand")
    assert updated_demand_res.status_code == 200
    updated_demands = {d["category"]: d for d in updated_demand_res.json()}
    updated_wooden_pct = updated_demands["Wooden Toys"]["demand_pct"]

    assert updated_wooden_pct > initial_wooden_pct, (
        f"Expected Wooden Toys demand to surge after buyer events. Initial: {initial_wooden_pct}, Updated: {updated_wooden_pct}"
    )

    # 4. Verify Seller Dashboard shows "demand is increasing"
    opp_res = client.get("/api/seller/opportunities")
    assert opp_res.status_code == 200
    data = opp_res.json()
    copilot = data["copilot_insight"]
    
    assert copilot is not None
    assert "increasing" in copilot["headline"].lower()
    assert "demand is increasing" in copilot["narrative"].lower()

    # 5. Verify category demand schema integrity
    kalamkari_demand = updated_demands["Kalamkari"]
    assert kalamkari_demand["demand_pct"] >= 0
    assert "demand_level" in kalamkari_demand
    assert "benchmark_price_range" in kalamkari_demand
