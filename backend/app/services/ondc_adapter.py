"""
ONDC / Beckn Protocol Adapter for Artisan AI.

Architecture Alignment:
As specified in Section 14.3 of the Product Architecture Document:
- ONDC is treated as a clean market-linkage adapter layer.
- Core marketplace logic does not couple directly to external network protocols.
- Converts internal canonical Product models into Beckn Protocol v1.2 schema
  (bpp/providers -> items -> descriptor, price, tags).
"""

from typing import Dict, Any, List, Optional
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from backend.app.models import Product

BPP_ID = "artisan-ai.beckn.network"
BPP_URI = "https://artisan-ai.beckn.network/bpp"

def transform_product_to_ondc_item(product: Product) -> Dict[str, Any]:
    """
    Transforms an Artisan AI product into an ONDC/Beckn Item schema.
    Preserves artisan heritage tags, transparent price, and images.
    """
    price_val = float(product.price) if product.price is not None else 0.0
    return {
        "id": f"artisan-item-{product.id}",
        "descriptor": {
            "name": product.title,
            "code": f"CRAFT-{product.category.upper().replace(' ', '-')}-{product.id}",
            "symbol": product.image_url or "",
            "short_desc": product.description or "",
            "long_desc": f"{product.description or ''} Craft Story: {product.craft_story or ''}",
            "images": [product.image_url] if product.image_url else []
        },
        "price": {
            "currency": "INR",
            "value": f"{price_val:.2f}",
            "maximum_value": f"{price_val:.2f}"
        },
        "category_id": product.category,
        "matched": True,
        "tags": [
            {
                "code": "heritage_credentials",
                "list": [
                    {"code": "artisan_direct", "value": "true"},
                    {"code": "craft_cluster", "value": "India National Handicrafts"},
                    {"code": "gi_certified", "value": "true" if getattr(product, "is_gi_certified", False) else "false"}
                ]
            }
        ]
    }

def build_ondc_catalog(products: List[Product]) -> Dict[str, Any]:
    """
    Builds a full Beckn on_search BPP catalog containing artisan items.
    """
    items = [transform_product_to_ondc_item(p) for p in products]
    categories = list({p.category for p in products})

    return {
        "context": {
            "domain": "nic2004:52110",
            "country": "IND",
            "city": "std:080",
            "action": "on_search",
            "core_version": "1.2.0",
            "bpp_id": BPP_ID,
            "bpp_uri": BPP_URI,
            "transaction_id": f"tx-artisan-{int(datetime.now(timezone.utc).timestamp())}",
            "message_id": f"msg-{int(datetime.now(timezone.utc).timestamp())}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        "message": {
            "catalog": {
                "bpp/descriptor": {
                    "name": "Artisan AI Marginalized Weaver Network",
                    "short_desc": "Direct B2B/B2C marketplace linkage for traditional Indian artisans"
                },
                "bpp/categories": [{"id": cat, "descriptor": {"name": cat}} for cat in categories],
                "bpp/providers": [
                    {
                        "id": "artisan-collective-1",
                        "descriptor": {
                            "name": "Generational Indian Handicraft Collective",
                            "short_desc": "Verified rural artisans and master craftspersons"
                        },
                        "items": items
                    }
                ]
            }
        }
    }

def handle_ondc_search(query: Optional[str], category: Optional[str], db: Session) -> Dict[str, Any]:
    """
    Processes a Beckn network search discovery request and returns the on_search catalog.
    """
    q = db.query(Product).filter(Product.status == "PUBLISHED")
    if category:
        q = q.filter(Product.category.ilike(f"%{category}%"))
    if query:
        q = q.filter(Product.title.ilike(f"%{query}%") | Product.description.ilike(f"%{query}%"))
    
    products = q.all()
    return build_ondc_catalog(products)
