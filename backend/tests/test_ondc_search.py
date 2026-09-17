"""
Tests for ONDC Search Discovery and Status API Endpoints.
Verifies:
- Standard /search asynchronous endpoint returning synchronous ACK
- Gateway alias /ondc/search
- Diagnostic local /catalog/query endpoint
- Category and keyword intent filtering
- Exclusion of drafts and out-of-stock items from discovery
- Honest /status diagnostics reporting NOT CONFIGURED or CONFIGURED - NOT VERIFIED
- Deprecation headers on legacy prototype endpoints
"""

import time
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.models import Product, User
from backend.app.integrations.ondc.status import ondc_status_tracker
from backend.tests.conftest import make_artisan_via_admin

client = TestClient(app)


def seed_discovery_products(db: Session, artisan_id: int):
    """Seeds test products with varying lifecycle statuses and stock levels."""
    p_published = Product(
        title="Dokra Brass Tribal Figurine",
        description="Traditional lost-wax bell metal craft from Bastar.",
        craft_story="Cast using generational lost-wax techniques by tribal master artisans.",
        category="Metal Crafts",
        materials="Brass, Clay, Beeswax",
        price=Decimal("1450.00"),
        stock=5,
        status="PUBLISHED",
        seller_id=artisan_id,
        handmade_pct=100,
        region_of_origin="Bastar, Chhattisgarh",
        verification_status="GI_VERIFIED",
        image_url="https://images.example.com/dokra.jpg"
    )
    p_draft = Product(
        title="Draft Wooden Mask",
        description="Draft status mask that should not be discovered.",
        category="Wood Crafts",
        price=Decimal("800.00"),
        stock=10,
        status="DRAFT",
        seller_id=artisan_id
    )
    p_out_of_stock = Product(
        title="Sold Out Dokra Horse",
        description="Sold out item that should not be discovered.",
        category="Metal Crafts",
        price=Decimal("1200.00"),
        stock=0,
        status="PUBLISHED",
        seller_id=artisan_id
    )
    db.add_all([p_published, p_draft, p_out_of_stock])
    db.commit()
    db.refresh(p_published)
    return p_published


def test_ondc_search_endpoint_returns_ack(admin_headers, db: Session):
    """POST /api/ondc/search receives valid Beckn search request and returns immediate ACK."""
    _, _, _, _ = make_artisan_via_admin(client, admin_headers)

    payload = {
        "context": {
            "domain": "ONDC:RET12",
            "country": "IND",
            "city": "std:080",
            "action": "search",
            "core_version": "1.2.0",
            "bap_id": "buyer-app.staging.ondc.org",
            "bap_uri": "https://buyer-app.staging.ondc.org/protocol/v1",
            "transaction_id": "tx-search-test-1",
            "message_id": f"msg-search-test-{int(time.time() * 1000)}",
            "timestamp": "2026-09-18T00:00:00.000Z",
            "ttl": "PT30S"
        },
        "message": {
            "intent": {
                "item": {
                    "descriptor": {
                        "name": "Dokra"
                    }
                }
            }
        }
    }

    res = client.post("/api/ondc/search", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "message" in data
    assert data["message"]["ack"]["status"] == "ACK"


def test_ondc_network_router_alias(admin_headers):
    """Network gateways can access /ondc/search directly without /api prefix."""
    payload = {
        "context": {
            "domain": "ONDC:RET12",
            "country": "IND",
            "city": "std:080",
            "action": "search",
            "core_version": "1.2.0",
            "bap_id": "gateway.staging.ondc.org",
            "bap_uri": "https://gateway.staging.ondc.org",
            "transaction_id": "tx-gw-test-1",
            "message_id": f"msg-gw-test-{int(time.time() * 1000)}",
            "timestamp": "2026-09-18T00:00:00.000Z"
        },
        "message": {
            "intent": {
                "category": {
                    "id": "Metal Crafts"
                }
            }
        }
    }
    res = client.post("/ondc/search", json=payload)
    assert res.status_code == 200
    assert res.json()["message"]["ack"]["status"] == "ACK"


def test_ondc_sync_catalog_query_keyword_discovery(admin_headers, db: Session):
    """POST /api/ondc/catalog/query searches eligible products synchronously for local verification."""
    _, _, _, artisan_headers = make_artisan_via_admin(client, admin_headers)
    # Get created artisan
    artisan_user = db.query(User).filter(User.role == "ARTISAN").order_by(User.id.desc()).first()
    p_published = seed_discovery_products(db, artisan_user.id)

    payload = {
        "context": {
            "domain": "ONDC:RET12",
            "country": "IND",
            "city": "std:080",
            "action": "search",
            "core_version": "1.2.0",
            "transaction_id": "tx-sync-query-1",
            "message_id": "msg-sync-query-1",
            "timestamp": "2026-09-18T00:00:00.000Z"
        },
        "message": {
            "intent": {
                "item": {
                    "descriptor": {
                        "name": "Dokra"
                    }
                }
            }
        }
    }

    res = client.post("/api/ondc/catalog/query", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["context"]["action"] == "on_search"
    catalog = data["message"]["catalog"]
    providers = catalog["bpp/providers"]
    assert len(providers) > 0

    # Ensure only published Dokra product is present
    all_item_names = [it["descriptor"]["name"] for prov in providers for it in prov["items"]]
    assert "Dokra Brass Tribal Figurine" in all_item_names
    assert "Draft Wooden Mask" not in all_item_names
    assert "Sold Out Dokra Horse" not in all_item_names


def test_ondc_sync_catalog_query_category_filter(admin_headers, db: Session):
    """Searching for non-existent category yields empty catalogue."""
    payload = {
        "context": {
            "domain": "ONDC:RET12",
            "action": "search",
            "transaction_id": "tx-empty-1",
            "message_id": "msg-empty-1",
            "timestamp": "2026-09-18T00:00:00.000Z"
        },
        "message": {
            "intent": {
                "category": {
                    "id": "NonExistentCraftCategoryXYZ"
                }
            }
        }
    }
    res = client.post("/api/ondc/catalog/query", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["message"]["catalog"]["bpp/providers"]) == 0


def test_ondc_status_endpoint_honest_reporting():
    """
    GET /api/ondc/status reports honest state without fake credentials or fake 'Connected' claims.
    verification_status must be 'NOT CONFIGURED' or 'CONFIGURED - NOT VERIFIED'.
    """
    res = client.get("/api/ondc/status")
    assert res.status_code == 200
    status = res.json()

    assert status["environment"] in ("DEVELOPMENT", "STAGING", "PRODUCTION", "TEST")
    assert status["verification_status"] in ("NOT CONFIGURED", "CONFIGURED - NOT VERIFIED")
    assert status["verified_live_interaction"] is False
    assert "ONDC:RET12" in status["supported_domains"]
    assert "ONDC:RET15" in status["supported_domains"]
    assert "demo_statement" in status
    assert "live network verification pending" in status["demo_statement"]

    # Security: No private keys leaked!
    assert "private_key" not in status
    assert "private_key_b64" not in status


def test_ondc_search_with_ret15_domain(admin_headers, db: Session):
    """POST /api/ondc/search accepts ONDC:RET15 (Home & Decor) domain."""
    payload = {
        "context": {
            "domain": "ONDC:RET15",
            "country": "IND",
            "city": "std:080",
            "action": "search",
            "core_version": "1.2.0",
            "bap_id": "buyer-app.staging.ondc.org",
            "bap_uri": "https://buyer-app.staging.ondc.org/protocol/v1",
            "transaction_id": "tx-ret15-search",
            "message_id": f"msg-ret15-{int(time.time() * 1000)}",
            "timestamp": "2026-09-18T00:00:00.000Z",
        },
        "message": {
            "intent": {
                "category": {
                    "id": "Pottery"
                }
            }
        }
    }
    res = client.post("/api/ondc/search", json=payload)
    assert res.status_code == 200
    assert res.json()["message"]["ack"]["status"] == "ACK"


def test_ondc_enforce_auth_rejects_unauthorized_request(monkeypatch):
    """When ONDC_ENFORCE_AUTH=True, requests without valid Authorization are rejected."""
    from backend.app.routes import ondc as ondc_module

    # Temporarily enable enforce_auth on config
    orig_enforce = ondc_module.ondc_config.enforce_auth
    try:
        ondc_module.ondc_config.enforce_auth = True

        payload = {
            "context": {
                "domain": "ONDC:RET12",
                "action": "search",
                "transaction_id": "tx-auth-fail",
                "message_id": "msg-auth-fail",
                "timestamp": "2026-09-18T00:00:00.000Z"
            },
            "message": {}
        }
        res = client.post("/api/ondc/search", json=payload)
        assert res.status_code == 401
        data = res.json()
        assert data["detail"]["message"]["ack"]["status"] == "NACK"
        assert data["detail"]["error"]["type"] == "AUTH-ERROR"
    finally:
        ondc_module.ondc_config.enforce_auth = orig_enforce


def test_deprecated_prototype_endpoints_have_deprecation_header():
    """Legacy prototype endpoints are marked with X-Deprecated headers."""
    res_select = client.post("/api/ondc/select", json={"product_id": 99999, "quantity": 1})
    assert "X-Deprecated" in res_select.headers
    assert "Prototype-only" in res_select.headers["X-Deprecated"]

