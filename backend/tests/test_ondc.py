"""
ONDC Protocol Integration Test Suite.
Consolidates:
- Part 1: Cryptographic Signing, Verification, and Replay Protection (Ed25519, BLAKE-512, Idempotency)
- Part 2: Product Discoverability and Eligibility Rules
- Part 3: Retail v1.2 Catalogue Mapping (Beckn schema, Heritage credentials)
- Part 4: Search Discovery, Diagnostics, and Gateway Endpoints
"""

import time
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.models import Product, User
from backend.app.integrations.ondc.config import ONDCConfig
from backend.app.integrations.ondc.handlers.catalog import (
    map_product_to_ondc_item,
    build_ondc_catalog,
    is_product_ondc_eligible,
    get_eligible_ondc_products_query,
)
from backend.app.integrations.ondc.signing import (
    generate_keypair,
    create_blake512_digest,
    create_signing_string,
    sign_request,
    verify_signature,
    parse_authorization_header,
    ONDCSigningError,
    ONDCSignatureVerificationError,
    ONDCTimestampExpiredError,
)
from backend.app.integrations.ondc.idempotency import ONDCIdempotencyTracker
from backend.app.integrations.ondc.registry import ONDCSubscriberRegistry
from backend.app.integrations.ondc.status import ondc_status_tracker
from backend.tests.conftest import make_artisan_via_admin

client = TestClient(app)


# =============================================================================
# FIXTURES & HELPERS
# =============================================================================

@pytest.fixture
def ondc_test_config():
    return ONDCConfig(
        environment="staging",
        subscriber_id="artisan-ai-bpp.staging",
        unique_key_id="key-1",
        bpp_uri="https://staging.artisan.ai/ondc",
        bpp_name="Artisan AI Gateway",
        bpp_description="Heritage Indian Crafts",
        domain="ONDC:RET12"
    )


def create_mock_artisan(db: Session, email: str = "artisan.ondc@test.com", status: str = "ACTIVE") -> User:
    artisan = User(
        name="Test Master Weaver",
        email=email,
        role="ARTISAN",
        status=status,
        craft="Handloom Weaving",
        craft_specialization="Pochampally Ikat",
        location="Telangana, India",
        verification_status="GI_VERIFIED",
        experience_years=15
    )
    db.add(artisan)
    db.commit()
    db.refresh(artisan)
    return artisan


def create_test_product(
    db: Session,
    seller: User,
    status: str = "PUBLISHED",
    stock: int = 5,
    price: Decimal = Decimal("2500.00"),
    title: str = "Handwoven Ikat Silk Saree",
    category: str = "Textiles"
) -> Product:
    prod = Product(
        title=title,
        description="Authentic handwoven silk saree with natural dyes.",
        craft_story="Woven on traditional pit loom over 14 days.",
        category=category,
        materials="Pure Mulberry Silk",
        price=price,
        stock=stock,
        status=status,
        seller_id=seller.id,
        handmade_pct=100,
        region_of_origin="Pochampally, Telangana",
        verification_status="GI_VERIFIED",
        image_url="https://images.example.com/saree.jpg"
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod


def seed_discovery_products(db: Session, artisan_id: int):
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


# =============================================================================
# PART 1: CRYPTOGRAPHIC SIGNING, VERIFICATION & IDEMPOTENCY
# =============================================================================

def test_ed25519_keypair_generation():
    """Generates valid 32-byte Ed25519 public and private keys."""
    pub_b64, priv_b64 = generate_keypair()
    assert isinstance(pub_b64, str) and len(pub_b64) == 44
    assert isinstance(priv_b64, str) and len(priv_b64) == 44


def test_blake512_digest_format():
    """Digest format must strictly follow 'BLAKE-512=<base64_digest>'."""
    body = b'{"message": {"intent": {"query": "saree"}}}'
    digest = create_blake512_digest(body)
    assert digest.startswith("BLAKE-512=")
    digest_val = digest[len("BLAKE-512="):]
    assert len(digest_val) == 88


def test_sign_and_verify_valid_request():
    """Sign an outgoing request and verify it succeeds with the corresponding public key."""
    pub_b64, priv_b64 = generate_keypair()
    subscriber_id = "artisan-ai-bpp.staging"
    unique_key_id = "key-2026"
    method = "POST"
    path = "/on_search"
    body = b'{"context": {"action": "on_search"}, "message": {"catalog": {}}}'

    headers = sign_request(
        private_key_b64=priv_b64,
        subscriber_id=subscriber_id,
        unique_key_id=unique_key_id,
        method=method,
        path=path,
        body=body,
        ttl_seconds=300
    )

    assert "Authorization" in headers
    assert "Digest" in headers
    auth_header = headers["Authorization"]
    assert f'keyId="{subscriber_id}|{unique_key_id}|ed25519"' in auth_header
    assert 'algorithm="ed25519"' in auth_header

    is_valid = verify_signature(
        auth_header=auth_header,
        method=method,
        path=path,
        body=body,
        public_key_b64=pub_b64,
        tolerance_seconds=300
    )
    assert is_valid is True


def test_verify_rejects_tampered_payload():
    """Tampering with even a single byte of body must cause verification failure."""
    pub_b64, priv_b64 = generate_keypair()
    method = "POST"
    path = "/on_search"
    body = b'{"amount": 1000}'

    headers = sign_request(
        private_key_b64=priv_b64,
        subscriber_id="sub1",
        unique_key_id="k1",
        method=method,
        path=path,
        body=body
    )

    tampered_body = b'{"amount": 1001}'
    with pytest.raises(ONDCSignatureVerificationError):
        verify_signature(
            auth_header=headers["Authorization"],
            method=method,
            path=path,
            body=tampered_body,
            public_key_b64=pub_b64
        )


def test_verify_rejects_expired_timestamp():
    """Request with an expired timestamp must be rejected with ONDCTimestampExpiredError."""
    pub_b64, priv_b64 = generate_keypair()
    method = "POST"
    path = "/search"
    body = b'{"action": "search"}'

    past_time = int(time.time()) - 1000
    headers = sign_request(
        private_key_b64=priv_b64,
        subscriber_id="sub1",
        unique_key_id="k1",
        method=method,
        path=path,
        body=body,
        created=past_time,
        ttl_seconds=60
    )

    with pytest.raises(ONDCTimestampExpiredError):
        verify_signature(
            auth_header=headers["Authorization"],
            method=method,
            path=path,
            body=body,
            public_key_b64=pub_b64,
            tolerance_seconds=60
        )


def test_verify_rejects_mismatched_public_key():
    """Verification must fail if signed with a different keypair."""
    pub_b64_a, priv_b64_a = generate_keypair()
    pub_b64_b, _ = generate_keypair()

    headers = sign_request(
        private_key_b64=priv_b64_a,
        subscriber_id="sub1",
        unique_key_id="k1",
        method="POST",
        path="/search",
        body=b'{"test": 1}'
    )

    with pytest.raises(ONDCSignatureVerificationError):
        verify_signature(
            auth_header=headers["Authorization"],
            method="POST",
            path="/search",
            body=b'{"test": 1}',
            public_key_b64=pub_b64_b
        )


def test_parse_authorization_header_errors():
    """Malformed headers must raise ONDCSignatureVerificationError."""
    with pytest.raises(ONDCSignatureVerificationError):
        parse_authorization_header("")

    with pytest.raises(ONDCSignatureVerificationError):
        parse_authorization_header('Signature keyId="foo"')


def test_idempotency_tracker():
    """Idempotency tracker detects duplicates and respects TTL."""
    tracker = ONDCIdempotencyTracker(ttl_seconds=2)
    tracker.clear()

    assert tracker.is_duplicate("msg_100", "tx_1") is False
    tracker.record("msg_100", "tx_1")
    assert tracker.is_duplicate("msg_100", "tx_1") is True
    assert tracker.is_duplicate("msg_101", "tx_1") is False

    time.sleep(2.1)
    assert tracker.is_duplicate("msg_100", "tx_1") is False


def test_subscriber_registry_trusted_resolution():
    """Registry resolves participant key from trusted list and caches it."""
    config = ONDCConfig(subscriber_id="my-bpp.com", public_key="my-pub-key")
    reg = ONDCSubscriberRegistry(config=config, ttl_seconds=60)

    assert reg.get_cached_public_key("my-bpp.com", "any-key") == "my-pub-key"
    assert reg.get_cached_public_key("unknown-bap.com", "key-1") is None

    pub_b64, priv_b64 = generate_keypair()
    reg.register_trusted_participant("trusted-bap.com", "key-bap-1", pub_b64)
    assert reg.get_cached_public_key("trusted-bap.com", "key-bap-1") == pub_b64


# =============================================================================
# PART 2: PRODUCT DISCOVERABILITY & ELIGIBILITY RULES
# =============================================================================

def test_eligible_published_product(db: Session):
    """A published, in-stock product from an active artisan must be eligible."""
    artisan = create_mock_artisan(db, "artisan1@ondc.test")
    product = create_test_product(db, artisan, status="PUBLISHED", stock=10)
    assert is_product_ondc_eligible(product) is True


def test_draft_product_ineligible(db: Session):
    """DRAFT products must NOT be eligible."""
    artisan = create_mock_artisan(db, "artisan2@ondc.test")
    product = create_test_product(db, artisan, status="DRAFT", stock=10)
    assert is_product_ondc_eligible(product) is False


@pytest.mark.parametrize("disallowed_status", [
    "AI_PROCESSING", "AI_GENERATED", "PENDING_APPROVAL", "APPROVED", "SUSPENDED"
])
def test_non_published_statuses_ineligible(db: Session, disallowed_status: str):
    """Only PUBLISHED status is allowed; unapproved or suspended products must be rejected."""
    artisan = create_mock_artisan(db, f"artisan_{disallowed_status.lower()}@ondc.test")
    product = create_test_product(db, artisan, status=disallowed_status, stock=10)
    assert is_product_ondc_eligible(product) is False


def test_zero_stock_product_ineligible(db: Session):
    """Zero stock products must NOT be eligible."""
    artisan = create_mock_artisan(db, "artisan_zero_stock@ondc.test")
    product = create_test_product(db, artisan, status="PUBLISHED", stock=0)
    assert is_product_ondc_eligible(product) is False


def test_negative_stock_product_ineligible(db: Session):
    """Negative stock products must NOT be eligible."""
    artisan = create_mock_artisan(db, "artisan_neg_stock@ondc.test")
    product = Product(
        title="Negative Stock Product",
        category="Pottery",
        price=Decimal("100.00"),
        stock=-1,
        status="PUBLISHED",
        seller=artisan
    )
    assert is_product_ondc_eligible(product) is False


def test_zero_or_negative_price_ineligible(db: Session):
    """Zero price products must NOT be eligible."""
    artisan = create_mock_artisan(db, "artisan_zero_price@ondc.test")
    product = create_test_product(db, artisan, status="PUBLISHED", stock=5, price=Decimal("0.00"))
    assert is_product_ondc_eligible(product) is False


def test_inactive_seller_ineligible(db: Session):
    """Products belonging to suspended or pending sellers must NOT be eligible."""
    artisan = create_mock_artisan(db, "artisan_suspended@ondc.test", status="SUSPENDED")
    product = create_test_product(db, artisan, status="PUBLISHED", stock=5)
    assert is_product_ondc_eligible(product) is False


def test_non_artisan_seller_ineligible(db: Session):
    """Products belonging to a BUYER or non-artisan user must NOT be eligible."""
    buyer = User(name="Buyer User", email="buyer@test.com", role="BUYER", status="ACTIVE")
    db.add(buyer)
    db.commit()
    db.refresh(buyer)

    product = create_test_product(db, buyer, status="PUBLISHED", stock=5)
    assert is_product_ondc_eligible(product) is False


def test_get_eligible_ondc_products_query_filters_correctly(db: Session):
    """The database query helper must return only eligible products."""
    artisan = create_mock_artisan(db, "artisan_query@ondc.test")
    p_good = create_test_product(db, artisan, title="Good Saree", status="PUBLISHED", stock=5)
    p_draft = create_test_product(db, artisan, title="Draft Saree", status="DRAFT", stock=5)
    p_out = create_test_product(db, artisan, title="Out of Stock Saree", status="PUBLISHED", stock=0)

    results = get_eligible_ondc_products_query(db).all()
    result_ids = [p.id for p in results]

    assert p_good.id in result_ids
    assert p_draft.id not in result_ids
    assert p_out.id not in result_ids


# =============================================================================
# PART 3: RETAIL v1.2 CATALOGUE MAPPING
# =============================================================================

def test_map_product_to_ondc_item_structure(db: Session):
    """Maps single Product to ONDC Item format with correct schema types."""
    artisan = User(
        id=42,
        name="Shri Ramulu",
        email="ramulu@weavers.in",
        role="ARTISAN",
        status="ACTIVE",
        craft="Pochampally Ikat",
        location="Telangana, India"
    )
    product = Product(
        id=101,
        title="Royal Silk Dupatta",
        description="Fine mulberry silk dupatta with traditional geometric motifs.",
        craft_story="Dyed using natural vegetable pigments.",
        category="Handlooms",
        materials="Silk, Natural Dyes",
        price=Decimal("1850.50"),
        stock=7,
        status="PUBLISHED",
        seller=artisan,
        seller_id=42,
        handmade_pct=95,
        region_of_origin="Pochampally",
        verification_status="GI_VERIFIED",
        image_url="https://images.example.com/dupatta.jpg"
    )

    item = map_product_to_ondc_item(product)

    assert item["id"] == "ARTISAN_PROD_101"
    assert item["descriptor"]["name"] == "Royal Silk Dupatta"
    assert "mulberry silk" in item["descriptor"]["short_desc"].lower()
    assert "Craft Story:" in item["descriptor"]["long_desc"]
    assert item["descriptor"]["images"] == ["https://images.example.com/dupatta.jpg"]

    # Price formatting
    assert item["price"]["currency"] == "INR"
    assert item["price"]["value"] == "1850.50"
    assert item["price"]["maximum_value"] == "1850.50"

    # Inventory
    assert item["quantity"]["available"]["count"] == 7
    assert item["quantity"]["maximum"]["count"] <= 10

    # Heritage Credentials tags
    tags = {t["code"]: {item_tag["code"]: item_tag["value"] for item_tag in t["list"]} for t in item["tags"]}
    assert "heritage_credentials" in tags
    hc = tags["heritage_credentials"]
    assert hc["artisan_direct"] == "true"
    assert hc["handmade_pct"] == "95"
    assert hc["gi_certified"] == "true"
    assert hc["craft_cluster"] == "Pochampally"

    # Materials tag
    assert "materials" in tags
    assert tags["materials"]["composition"] == "Silk, Natural Dyes"


def test_build_ondc_catalog_groups_by_artisan_provider(db: Session, ondc_test_config):
    """Builds catalog grouping multiple products under their respective artisan sellers."""
    artisan_a = User(id=1, name="Artisan A", role="ARTISAN", status="ACTIVE", craft="Pottery", location="Khurja")
    artisan_b = User(id=2, name="Artisan B", role="ARTISAN", status="ACTIVE", craft="Woodwork", location="Saharanpur")

    p1 = Product(id=1, title="Terracotta Vase", price=Decimal("450.00"), stock=3, status="PUBLISHED", category="Pottery", seller=artisan_a, seller_id=1)
    p2 = Product(id=2, title="Clay Pot", price=Decimal("250.00"), stock=8, status="PUBLISHED", category="Pottery", seller=artisan_a, seller_id=1)
    p3 = Product(id=3, title="Carved Wooden Box", price=Decimal("1200.00"), stock=2, status="PUBLISHED", category="Woodcraft", seller=artisan_b, seller_id=2)

    catalog = build_ondc_catalog([p1, p2, p3], ondc_test_config)

    assert "bpp/descriptor" in catalog
    assert catalog["bpp/descriptor"]["name"] == ondc_test_config.bpp_name

    categories = [c["id"] for c in catalog["bpp/categories"]]
    assert "Pottery" in categories
    assert "Woodcraft" in categories

    providers = catalog["bpp/providers"]
    assert len(providers) == 2

    prov_map = {p["id"]: p for p in providers}
    assert "ARTISAN_SELLER_1" in prov_map
    assert "ARTISAN_SELLER_2" in prov_map

    items_a = prov_map["ARTISAN_SELLER_1"]["items"]
    assert len(items_a) == 2
    item_ids_a = [it["id"] for it in items_a]
    assert "ARTISAN_PROD_1" in item_ids_a
    assert "ARTISAN_PROD_2" in item_ids_a

    items_b = prov_map["ARTISAN_SELLER_2"]["items"]
    assert len(items_b) == 1
    assert items_b[0]["id"] == "ARTISAN_PROD_3"


def test_build_ondc_catalog_excludes_ineligible_products(db: Session, ondc_test_config):
    """Catalog assembly must omit draft or out of stock products."""
    artisan = User(id=5, name="Artisan C", role="ARTISAN", status="ACTIVE", craft="Metals", location="Moradabad")

    p_valid = Product(id=10, title="Brass Bell", price=Decimal("500.00"), stock=4, status="PUBLISHED", category="Metalware", seller=artisan, seller_id=5)
    p_draft = Product(id=11, title="Draft Bell", price=Decimal("500.00"), stock=4, status="DRAFT", category="Metalware", seller=artisan, seller_id=5)
    p_zero = Product(id=12, title="Zero Bell", price=Decimal("500.00"), stock=0, status="PUBLISHED", category="Metalware", seller=artisan, seller_id=5)

    catalog = build_ondc_catalog([p_valid, p_draft, p_zero], ondc_test_config)
    providers = catalog["bpp/providers"]
    assert len(providers) == 1
    items = providers[0]["items"]
    assert len(items) == 1
    assert items[0]["id"] == "ARTISAN_PROD_10"


# =============================================================================
# PART 4: SEARCH DISCOVERY, STATUS & GATEWAY ENDPOINTS
# =============================================================================

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
    _, _, _, _ = make_artisan_via_admin(client, admin_headers)
    artisan_user = db.query(User).filter(User.role == "ARTISAN").order_by(User.id.desc()).first()
    _ = seed_discovery_products(db, artisan_user.id)

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
