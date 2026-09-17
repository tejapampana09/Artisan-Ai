"""
ONDC Search Request Handler.
Processes Beckn discovery intent, queries eligible artisan products,
assembles the on_search catalogue payload, and records safe telemetry.
"""

import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.models import Product, Event
from backend.app.integrations.ondc.config import ONDCConfig
from backend.app.integrations.ondc.schemas.search import ONDCSearchRequest
from backend.app.integrations.ondc.handlers.catalog import (
    get_eligible_ondc_products_query,
    build_ondc_catalog
)

logger = logging.getLogger("artisan_ai.ondc.search")

def extract_search_intent(req: ONDCSearchRequest) -> Dict[str, Optional[str]]:
    """Extracts keyword, category, and provider criteria from incoming search intent."""
    query_str = None
    category_str = None
    provider_str = None

    if req.message and req.message.intent:
        intent = req.message.intent
        # 1. Direct query
        if intent.query:
            query_str = intent.query.strip()
        # 2. Item descriptor name
        elif intent.item and intent.item.descriptor and intent.item.descriptor.name:
            query_str = intent.item.descriptor.name.strip()

        # 3. Category
        if intent.category:
            if intent.category.id:
                category_str = intent.category.id.strip()
            elif intent.category.descriptor and intent.category.descriptor.name:
                category_str = intent.category.descriptor.name.strip()

        # 4. Provider
        if intent.provider:
            if intent.provider.id:
                provider_str = intent.provider.id.strip()
            elif intent.provider.descriptor and intent.provider.descriptor.name:
                provider_str = intent.provider.descriptor.name.strip()

    return {
        "query": query_str,
        "category": category_str,
        "provider": provider_str
    }


def execute_ondc_search(
    req: ONDCSearchRequest,
    db: Session,
    config: ONDCConfig
) -> Dict[str, Any]:
    """
    Executes seller-side search against the platform's eligible products.
    Returns the complete Beckn 'on_search' response dictionary.
    """
    criteria = extract_search_intent(req)
    search_query = criteria["query"]
    category_filter = criteria["category"]
    provider_filter = criteria["provider"]

    query = get_eligible_ondc_products_query(db)

    if category_filter:
        query = query.filter(Product.category.ilike(f"%{category_filter}%"))

    if search_query:
        term = f"%{search_query}%"
        query = query.filter(
            or_(
                Product.title.ilike(term),
                Product.description.ilike(term),
                Product.category.ilike(term),
                Product.materials.ilike(term),
                Product.craft_story.ilike(term)
            )
        )

    if provider_filter:
        # Check if provider_filter is numeric artisan seller ID or string
        clean_prov = provider_filter.replace("ARTISAN_SELLER_", "")
        if clean_prov.isdigit():
            query = query.filter(Product.seller_id == int(clean_prov))

    products = query.order_by(Product.id.desc()).all()

    # Build Beckn catalogue
    catalog = build_ondc_catalog(products, config)

    # Record safe search event in platform telemetry
    try:
        telemetry_meta = {
            "source": "ONDC_NETWORK",
            "transaction_id": req.context.transaction_id,
            "bap_id": req.context.bap_id,
            "results_count": len(products)
        }
        db.add(Event(
            event_type="SEARCH",
            category=category_filter,
            query=search_query,
            metadata_info=json.dumps(telemetry_meta)
        ))
        db.commit()
    except Exception as ev_err:
        db.rollback()
        logger.warning("Could not record ONDC search telemetry: %s", ev_err)

    # Construct on_search context
    on_search_context = {
        "domain": req.context.domain,
        "country": req.context.country,
        "city": req.context.city,
        "action": "on_search",
        "core_version": req.context.core_version,
        "bap_id": req.context.bap_id,
        "bap_uri": req.context.bap_uri,
        "bpp_id": config.subscriber_id or "artisan-ai-bpp",
        "bpp_uri": config.bpp_uri,
        "transaction_id": req.context.transaction_id,
        "message_id": req.context.message_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ttl": config.ttl
    }

    return {
        "context": on_search_context,
        "message": {
            "catalog": catalog
        }
    }
