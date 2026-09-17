"""
Artisan AI - ONDC Retail Seller-Side Integration Module.
Beckn Protocol v1.2 discovery, catalogue mapping, cryptographic signing,
and seller-side callback management.
"""

from backend.app.integrations.ondc.config import ondc_config, ONDCConfig, load_ondc_config
from backend.app.integrations.ondc.status import ondc_status_tracker, ONDCStatusTracker
from backend.app.integrations.ondc.idempotency import ondc_idempotency
from backend.app.integrations.ondc.client import ONDCClient, get_ondc_client
from backend.app.integrations.ondc.signing import (
    sign_request,
    verify_signature,
    generate_keypair,
    create_blake512_digest,
    ONDCSigningError,
    ONDCSignatureVerificationError,
    ONDCTimestampExpiredError,
)
from backend.app.integrations.ondc.handlers.catalog import (
    is_product_ondc_eligible,
    get_eligible_ondc_products_query,
    map_product_to_ondc_item,
    build_ondc_catalog,
)
from backend.app.integrations.ondc.handlers.search import (
    extract_search_intent,
    execute_ondc_search,
)

__all__ = [
    "ondc_config",
    "ONDCConfig",
    "load_ondc_config",
    "ondc_status_tracker",
    "ONDCStatusTracker",
    "ondc_idempotency",
    "ONDCClient",
    "get_ondc_client",
    "sign_request",
    "verify_signature",
    "generate_keypair",
    "create_blake512_digest",
    "ONDCSigningError",
    "ONDCSignatureVerificationError",
    "ONDCTimestampExpiredError",
    "is_product_ondc_eligible",
    "get_eligible_ondc_products_query",
    "map_product_to_ondc_item",
    "build_ondc_catalog",
    "extract_search_intent",
    "execute_ondc_search",
]
