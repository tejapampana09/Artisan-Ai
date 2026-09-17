"""
Tests for ONDC Product Discoverability Eligibility Rules.
Verifies that ONLY products meeting all strict criteria:
- Owned by an active, authenticated artisan seller
- Status == 'PUBLISHED'
- Stock > 0
- Valid positive price
- Non-empty title and category
are discoverable on the ONDC network.
"""

from decimal import Decimal
import pytest
from sqlalchemy.orm import Session

from backend.app.models import Product, User
from backend.app.integrations.ondc.handlers.catalog import (
    is_product_ondc_eligible,
    get_eligible_ondc_products_query,
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
    # Eligible
    p_good = create_test_product(db, artisan, title="Good Saree", status="PUBLISHED", stock=5)
    # Ineligible
    p_draft = create_test_product(db, artisan, title="Draft Saree", status="DRAFT", stock=5)
    p_out = create_test_product(db, artisan, title="Out of Stock Saree", status="PUBLISHED", stock=0)

    results = get_eligible_ondc_products_query(db).all()
    result_ids = [p.id for p in results]

    assert p_good.id in result_ids
    assert p_draft.id not in result_ids
    assert p_out.id not in result_ids
