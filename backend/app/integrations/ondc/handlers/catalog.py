"""
ONDC Catalogue Handler and Product Eligibility Engine.
Enforces strict product eligibility rules and transforms canonical Artisan AI
Product and User models into standards-compliant ONDC Retail v1.2 catalogue structures.
"""

from typing import List, Dict, Any, Optional
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_

from backend.app.models import Product, User
from backend.app.integrations.ondc.config import ONDCConfig

def is_product_ondc_eligible(product: Product) -> bool:
    """
    Evaluates whether a product meets all ONDC discoverability criteria.
    Criteria:
    1. Product lifecycle status must be strictly 'PUBLISHED'
    2. Available stock must be greater than 0
    3. Price must be positive (> 0)
    4. Product title and category must be valid non-empty strings
    5. Product must belong to an active, authenticated artisan seller
    """
    if not product:
        return False

    if product.status != "PUBLISHED":
        return False

    if product.stock is None or product.stock <= 0:
        return False

    if product.price is None:
        return False
    try:
        if Decimal(str(product.price)) <= Decimal("0.00"):
            return False
    except Exception:
        return False

    if not product.title or not product.title.strip():
        return False

    if not product.category or not product.category.strip():
        return False

    # Seller validation
    seller = product.seller
    if not seller:
        return False

    if seller.role != "ARTISAN" or seller.status != "ACTIVE":
        return False

    return True


def get_eligible_ondc_products_query(db: Session):
    """
    Builds an optimized SQLAlchemy query returning only ONDC-eligible products.
    Pre-filters by PUBLISHED status, positive stock, positive price, and active artisan seller.
    """
    return (
        db.query(Product)
        .join(User, Product.seller_id == User.id)
        .filter(
            Product.status == "PUBLISHED",
            Product.stock > 0,
            Product.price > 0,
            Product.title.isnot(None),
            Product.category.isnot(None),
            User.role == "ARTISAN",
            User.status == "ACTIVE"
        )
    )


def map_product_to_ondc_item(product: Product) -> Dict[str, Any]:
    """
    Maps an Artisan AI product entity into an ONDC Retail Item representation.
    Preserves artisan heritage credentials, GI indicators, and pricing.
    """
    price_val = Decimal(str(product.price)).quantize(Decimal("0.01"))
    images = []
    if product.image_url:
        images.append(product.image_url)
    if product.enhanced_image_url and product.enhanced_image_url != product.image_url:
        images.append(product.enhanced_image_url)

    desc = product.description or ""
    craft_story = product.craft_story or ""
    long_desc = f"{desc}\n\nCraft Story: {craft_story}".strip() if craft_story else desc

    # GI and craft tags
    gi_certified = "true" if (
        "GI" in (product.category.upper() + str(product.verification_status or "").upper())
    ) else "false"

    tags = [
        {
            "code": "heritage_credentials",
            "list": [
                {"code": "artisan_direct", "value": "true"},
                {"code": "craft_cluster", "value": product.region_of_origin or "Indian Handicraft Cluster"},
                {"code": "handmade_pct", "value": str(product.handmade_pct if product.handmade_pct is not None else 100)},
                {"code": "gi_certified", "value": gi_certified},
                {"code": "verification_status", "value": str(product.verification_status or "ARTISAN_PROVIDED")},
            ]
        }
    ]

    if product.materials:
        tags.append({
            "code": "materials",
            "list": [
                {"code": "composition", "value": product.materials}
            ]
        })

    item_id = f"ARTISAN_PROD_{product.id}"
    seller_loc_id = f"LOC_{product.seller_id}" if product.seller_id else "LOC_1"

    return {
        "id": item_id,
        "descriptor": {
            "name": product.title,
            "code": f"SKU-{product.id}",
            "symbol": product.image_url or "",
            "short_desc": desc,
            "long_desc": long_desc,
            "images": images
        },
        "category_id": product.category,
        "price": {
            "currency": "INR",
            "value": str(price_val),
            "maximum_value": str(price_val)
        },
        "quantity": {
            "available": {"count": int(product.stock)},
            "maximum": {"count": min(int(product.stock), 10)}
        },
        "fulfillment_id": "F1_STANDARD_SHIPPING",
        "location_id": seller_loc_id,
        "matched": True,
        "tags": tags
    }


def build_ondc_catalog(products: List[Product], config: ONDCConfig) -> Dict[str, Any]:
    """
    Builds a complete ONDC Retail Beckn on_search catalogue payload
    grouping eligible items by artisan provider.
    """
    eligible_products = [p for p in products if is_product_ondc_eligible(p)]

    # Group products by seller
    providers_map: Dict[int, Dict[str, Any]] = {}
    categories_set = set()

    for p in eligible_products:
        seller = p.seller
        seller_id = seller.id if seller else 1
        seller_name = seller.name if seller else "Master Craftsperson"
        seller_craft = seller.craft_specialization or seller.craft or "Traditional Indian Handicrafts"
        seller_loc = seller.location or "India"

        if seller_id not in providers_map:
            providers_map[seller_id] = {
                "id": f"ARTISAN_SELLER_{seller_id}",
                "descriptor": {
                    "name": f"{seller_name} - Artisan Studio",
                    "short_desc": f"Direct workshop of artisan {seller_name}, specializing in {seller_craft}.",
                    "symbol": seller.avatar_url or "",
                    "images": [seller.avatar_url] if seller.avatar_url else []
                },
                "locations": [
                    {
                        "id": f"LOC_{seller_id}",
                        "gps": "12.9716,77.5946",
                        "address": {
                            "locality": seller_loc,
                            "country": "IND"
                        }
                    }
                ],
                "categories": [],
                "fulfillments": [
                    {
                        "id": "F1_STANDARD_SHIPPING",
                        "type": "Delivery"
                    }
                ],
                "items": [],
                "tags": [
                    {
                        "code": "artisan_profile",
                        "list": [
                            {"code": "experience_years", "value": str(seller.experience_years if seller else 0)},
                            {"code": "verification", "value": str(seller.verification_status if seller else "UNVERIFIED")}
                        ]
                    }
                ]
            }

        item_repr = map_product_to_ondc_item(p)
        providers_map[seller_id]["items"].append(item_repr)
        categories_set.add(p.category)

    bpp_categories = [
        {"id": cat, "descriptor": {"name": cat}}
        for cat in sorted(categories_set)
    ]

    # Populate categories inside providers
    for prov in providers_map.values():
        prov_cats = {it["category_id"] for it in prov["items"]}
        prov["categories"] = [{"id": c, "descriptor": {"name": c}} for c in sorted(prov_cats)]

    bpp_providers = list(providers_map.values())

    return {
        "bpp/descriptor": {
            "name": config.bpp_name,
            "short_desc": config.bpp_description,
            "symbol": "https://artisan-ai.example.com/logo.png"
        },
        "bpp/categories": bpp_categories,
        "bpp/fulfillments": [
            {
                "id": "F1_STANDARD_SHIPPING",
                "type": "Delivery"
            }
        ],
        "bpp/providers": bpp_providers
    }
