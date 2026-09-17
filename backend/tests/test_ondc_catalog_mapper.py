"""
Tests for ONDC Retail v1.2 Catalogue Mapping.
Verifies that Artisan AI products and artisan profiles are accurately mapped
into Beckn Retail schema objects with stable IDs, INR pricing, and heritage tags.
"""

from decimal import Decimal
import pytest
from sqlalchemy.orm import Session

from backend.app.models import Product, User
from backend.app.integrations.ondc.config import ONDCConfig
from backend.app.integrations.ondc.handlers.catalog import (
    map_product_to_ondc_item,
    build_ondc_catalog,
)


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

    # Categories list
    categories = [c["id"] for c in catalog["bpp/categories"]]
    assert "Pottery" in categories
    assert "Woodcraft" in categories

    # Providers list
    providers = catalog["bpp/providers"]
    assert len(providers) == 2

    prov_map = {p["id"]: p for p in providers}
    assert "ARTISAN_SELLER_1" in prov_map
    assert "ARTISAN_SELLER_2" in prov_map

    # Artisan A should have 2 items
    items_a = prov_map["ARTISAN_SELLER_1"]["items"]
    assert len(items_a) == 2
    item_ids_a = [it["id"] for it in items_a]
    assert "ARTISAN_PROD_1" in item_ids_a
    assert "ARTISAN_PROD_2" in item_ids_a

    # Artisan B should have 1 item
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
