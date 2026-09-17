"""
ONDC / Beckn Protocol Adapter for Artisan AI.
Backward compatibility layer delegating to backend.app.integrations.ondc.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from backend.app.models import Product
from backend.app.integrations.ondc import (
    ondc_config,
    map_product_to_ondc_item,
    build_ondc_catalog as _build_ondc_catalog,
    execute_ondc_search,
    is_product_ondc_eligible,
)
from backend.app.integrations.ondc.schemas import (
    ONDCSearchRequest,
    ONDCContext,
    ONDCSearchMessage,
    ONDCSearchIntent,
)

BPP_ID = ondc_config.subscriber_id or "artisan-ai.beckn.network"
BPP_URI = ondc_config.bpp_uri


def transform_product_to_ondc_item(product: Product) -> Dict[str, Any]:
    """Transforms an Artisan AI product into an ONDC Retail Item representation."""
    return map_product_to_ondc_item(product)


def build_ondc_catalog(products: List[Product]) -> Dict[str, Any]:
    """Builds a full Beckn on_search BPP catalog containing artisan items."""
    raw_cat = _build_ondc_catalog(products, ondc_config)
    return {
        "context": {
            "domain": ondc_config.domain,
            "country": ondc_config.country,
            "city": ondc_config.city,
            "action": "on_search",
            "core_version": ondc_config.core_version,
            "bpp_id": BPP_ID,
            "bpp_uri": BPP_URI,
            "transaction_id": f"tx-artisan-{int(datetime.now(timezone.utc).timestamp())}",
            "message_id": f"msg-{int(datetime.now(timezone.utc).timestamp())}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        "message": {
            "catalog": raw_cat
        }
    }


def handle_ondc_search(query: Optional[str], category: Optional[str], db: Session) -> Dict[str, Any]:
    """Processes a Beckn network search discovery request and returns the on_search catalog."""
    now_ts = datetime.now(timezone.utc).isoformat()
    req = ONDCSearchRequest(
        context=ONDCContext(
            domain=ondc_config.domain,
            action="search",
            transaction_id=f"tx-{int(datetime.now(timezone.utc).timestamp())}",
            message_id=f"msg-{int(datetime.now(timezone.utc).timestamp())}",
            timestamp=now_ts
        ),
        message=ONDCSearchMessage(
            intent=ONDCSearchIntent(
                query=query,
                category={"id": category} if category else None
            )
        )
    )
    return execute_ondc_search(req, db, ondc_config)
