"""
ONDC Retail Seller-Side Router (Beckn Protocol v1.2).
Provides:
- Standard asynchronous /search discovery endpoint with immediate synchronous ACK
  and background signed /on_search callback delivery.
- Synchronous diagnostic /catalog/query endpoint for local inspection and automated testing.
- Honest integration status and diagnostic health endpoint (/status).
- Deprecated legacy prototype order draft endpoints marked as internal prototypes only.
"""

import json
import logging
from decimal import Decimal
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import update

from backend.app.database import get_db, SessionLocal
from backend.app.models import Product, Order, Event, User
from backend.app.services.auth import get_current_user_strict
from backend.app.services.pricing_engine import trigger_auto_pricing

from backend.app.integrations.ondc.config import ondc_config, ONDCConfig
from backend.app.integrations.ondc.status import ondc_status_tracker
from backend.app.integrations.ondc.idempotency import ondc_idempotency
from backend.app.integrations.ondc.client import get_ondc_client
from backend.app.integrations.ondc.registry import ondc_registry
from backend.app.integrations.ondc.signing import (
    verify_signature,
    parse_authorization_header,
    ONDCSignatureVerificationError,
    ONDCTimestampExpiredError,
)
from backend.app.integrations.ondc.schemas import (
    ONDCSearchRequest,
    ONDCAckResponse,
    make_ack,
    make_nack,
)
from backend.app.integrations.ondc.handlers import execute_ondc_search

# Wire configuration to registry resolver
ondc_registry.set_config(ondc_config)

logger = logging.getLogger("artisan_ai.ondc.router")

router = APIRouter(
    prefix="/api/ondc",
    tags=["ONDC Retail Integration"]
)

# Root-level router for network gateways that query /ondc/search directly without /api prefix
ondc_network_router = APIRouter(
    prefix="/ondc",
    tags=["ONDC Network Gateway"]
)


async def _async_process_and_callback(
    req: ONDCSearchRequest,
    config: ONDCConfig
):
    """Background task to query products and post signed on_search callback to requesting BAP."""
    db: Session = SessionLocal()
    try:
        on_search_payload = execute_ondc_search(req, db, config)
        ondc_status_tracker.record_search_success()

        if req.context.bap_uri:
            client = get_ondc_client(config)
            await client.send_on_search_callback(
                bap_uri=req.context.bap_uri,
                payload=on_search_payload
            )
        else:
            logger.warning("Search request %s has no bap_uri; skipped callback", req.context.message_id)
    except Exception as exc:
        err = f"Failed in background on_search callback: {exc}"
        logger.error(err, exc_info=True)
        ondc_status_tracker.record_error(err)
    finally:
        db.close()


async def _verify_inbound_request_auth(request: Request, body_bytes: bytes, config: ONDCConfig):
    """
    Validates inbound HTTP signature per ONDC participant specifications.
    1. Extracts keyId (subscriber_id|unique_key_id|algorithm) from Authorization header.
    2. Resolves participant public key from trusted cache or ONDC registry lookup.
    3. If enforce_auth=True: strictly verifies Ed25519 signature and BLAKE-512 digest.
    4. If enforce_auth=False: permissive development mode, logs verification result without blocking.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        if config.enforce_auth:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=make_nack("AUTH-ERROR", "10001", "Missing Authorization signature header")
            )
        else:
            logger.debug("Inbound request without Authorization header accepted in permissive development mode")
            return

    # Auth header is present: parse participant key parameters
    try:
        header_params = parse_authorization_header(auth_header)
    except Exception as parse_err:
        if config.enforce_auth:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=make_nack("AUTH-ERROR", "10002", f"Malformed Authorization header: {parse_err}")
            )
        logger.warning("Permissive mode: Malformed Authorization header ignored: %s", parse_err)
        return

    key_id = header_params.get("keyId", "")
    parts = key_id.split("|")
    sender_subscriber_id = parts[0] if len(parts) > 0 else ""
    sender_unique_key_id = parts[1] if len(parts) > 1 else ""

    # Resolve sender's public key from registry or trusted cache
    sender_public_key = await ondc_registry.lookup_public_key(
        subscriber_id=sender_subscriber_id,
        unique_key_id=sender_unique_key_id,
        domain=config.domain
    )

    if not sender_public_key:
        if config.enforce_auth:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=make_nack(
                    "AUTH-ERROR",
                    "10003",
                    f"Unknown or unverified participant '{sender_subscriber_id}'. Public key could not be resolved from trusted list or registry."
                )
            )
        logger.warning(
            "Permissive mode: No public key found for participant '%s' (keyId '%s'). Skipping signature verification.",
            sender_subscriber_id,
            sender_unique_key_id
        )
        return

    # Verify signature against the sender's public key
    try:
        verify_signature(
            auth_header=auth_header,
            method=request.method,
            path=request.url.path,
            body=body_bytes,
            public_key_b64=sender_public_key,
            tolerance_seconds=config.auth_timestamp_tolerance_seconds
        )
        logger.debug("Successfully verified inbound ONDC signature for subscriber '%s'", sender_subscriber_id)
    except ONDCTimestampExpiredError as exp_err:
        if config.enforce_auth:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=make_nack("CONTEXT-ERROR", "10004", str(exp_err))
            )
        logger.warning("Permissive mode: Inbound timestamp expired: %s", exp_err)
    except ONDCSignatureVerificationError as sig_err:
        if config.enforce_auth:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=make_nack("AUTH-ERROR", "10005", str(sig_err))
            )
        logger.warning("Permissive mode: Inbound signature verification failed: %s", sig_err)


@router.post("/search", response_model=ONDCAckResponse)
@ondc_network_router.post("/search", response_model=ONDCAckResponse)
async def ondc_search(
    req: ONDCSearchRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    ONDC Seller-Side Discovery Endpoint (/search).
    Standard Beckn flow:
    1. Validates inbound signature (if configured/enforced)
    2. Validates context and checks message idempotency
    3. Returns synchronous ACK
    4. Dispatches asynchronous task to query eligible products and post /on_search callback to bap_uri
    """
    body_bytes = await request.body()
    await _verify_inbound_request_auth(request, body_bytes, ondc_config)

    ondc_status_tracker.record_search_received()

    # Replay protection / idempotency check
    msg_id = req.context.message_id
    tx_id = req.context.transaction_id

    if ondc_idempotency.is_duplicate(msg_id, tx_id):
        logger.info("Duplicate search request ignored (transaction_id=%s, message_id=%s)", tx_id, msg_id)
        return make_ack()

    ondc_idempotency.record(msg_id, tx_id)

    # Dispatch asynchronous background task
    background_tasks.add_task(_async_process_and_callback, req, ondc_config)

    return make_ack()


@router.post("/catalog/query")
def ondc_sync_catalog_query(
    req: ONDCSearchRequest,
    db: Session = Depends(get_db)
):
    """
    Synchronous ONDC Catalogue Discovery Query Endpoint.
    Provided for diagnostic inspection, integration tests, and local development
    without needing an active external BAP receiver.
    """
    ondc_status_tracker.record_search_received()
    result = execute_ondc_search(req, db, ondc_config)
    ondc_status_tracker.record_search_success()
    return result


@router.get("/status")
def ondc_integration_status():
    """
    Honest ONDC Connectivity and Health Diagnostic Endpoint.
    Reports participant configuration, signing readiness, verification state,
    and timestamps of recent protocol interactions.
    Never reports 'VERIFIED' without an actual successful network exchange.
    """
    return ondc_status_tracker.get_status_report(ondc_config)


# ==============================================================================
# DEPRECATED PROTOTYPE-ONLY ENDPOINTS (Retained for Backward Compatibility)
# ==============================================================================

class ONDCSelectRequest(BaseModel):
    product_id: int
    quantity: int = 1

class ONDCInitRequest(BaseModel):
    product_id: int
    quantity: int = 1
    buyer_name: str
    buyer_phone: str
    delivery_address: str

class ONDCConfirmRequest(BaseModel):
    product_id: int
    quantity: int = 1
    buyer_name: str
    buyer_phone: str
    delivery_address: str


@router.post("/select", deprecated=True)
def ondc_select_deprecated(req: ONDCSelectRequest, response: Response, db: Session = Depends(get_db)):
    """[DEPRECATED / PROTOTYPE ONLY] Not part of live ONDC network."""
    dep_headers = {"X-Deprecated": "Prototype-only endpoint - not part of active ONDC network"}
    response.headers.update(dep_headers)
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found on local ONDC registry", headers=dep_headers)

    if product.stock < req.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock for requested quantity", headers=dep_headers)

    unit_price = Decimal(str(product.price))
    item_total = unit_price * req.quantity
    estimated_delivery_fee = Decimal("50.00")
    grand_total = item_total + estimated_delivery_fee

    return {
        "context": {
            "action": "on_select",
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        "message": {
            "order": {
                "provider": {"id": f"ARTISAN_SELLER_{product.seller_id or 1}"},
                "items": [{"id": f"ARTISAN_PROD_{product.id}", "quantity": {"count": req.quantity}}],
                "quote": {
                    "price": {"currency": "INR", "value": str(grand_total)},
                    "breakup": [
                        {"title": product.title, "price": {"currency": "INR", "value": str(item_total)}},
                        {"title": "Estimated Delivery Fee (Prototype Adapter)", "price": {"currency": "INR", "value": str(estimated_delivery_fee)}}
                    ]
                }
            }
        }
    }


@router.post("/init", deprecated=True)
def ondc_init_deprecated(req: ONDCInitRequest, response: Response, db: Session = Depends(get_db)):
    """[DEPRECATED / PROTOTYPE ONLY] Not part of live ONDC network."""
    dep_headers = {"X-Deprecated": "Prototype-only endpoint - not part of active ONDC network"}
    response.headers.update(dep_headers)
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found", headers=dep_headers)

    unit_price = Decimal(str(product.price))
    estimated_delivery_fee = Decimal("50.00")
    grand_total = (unit_price * req.quantity) + estimated_delivery_fee

    return {
        "context": {"action": "on_init", "timestamp": datetime.now(timezone.utc).isoformat()},
        "message": {
            "order": {
                "provider": {"id": f"ARTISAN_SELLER_{product.seller_id or 1}"},
                "items": [{"id": f"ARTISAN_PROD_{product.id}", "quantity": {"count": req.quantity}}],
                "billing": {"name": req.buyer_name, "phone": req.buyer_phone},
                "fulfillment": {"end": {"location": {"address": {"name": req.delivery_address}}}},
                "quote": {"price": {"currency": "INR", "value": str(grand_total)}}
            }
        }
    }


@router.post("/confirm", deprecated=True)
def ondc_confirm_deprecated(
    req: ONDCConfirmRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_strict)
):
    """[DEPRECATED / PROTOTYPE ONLY] Not part of live ONDC network."""
    dep_headers = {"X-Deprecated": "Prototype-only endpoint - not part of active ONDC network"}
    response.headers.update(dep_headers)
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found", headers=dep_headers)

    stmt = (
        update(Product)
        .where(Product.id == req.product_id, Product.stock >= req.quantity)
        .values(stock=Product.stock - req.quantity)
    )
    result = db.execute(stmt)
    if result.rowcount == 0:
        db.rollback()
        prod_check = db.query(Product).filter(Product.id == req.product_id).first()
        available = prod_check.stock if prod_check else 0
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock unavailable or concurrent order collision: requested {req.quantity}, available {available}.",
            headers=dep_headers
        )

    unit_price = Decimal(str(product.price))
    total_price = unit_price * req.quantity

    new_order = Order(
        product_id=product.id,
        user_id=current_user.id,
        buyer_name=req.buyer_name,
        buyer_phone=req.buyer_phone,
        quantity=req.quantity,
        unit_price=unit_price,
        total_price=total_price,
        delivery_address=req.delivery_address,
        status="CONFIRMED"
    )
    db.add(new_order)

    db.add(Event(
        event_type="ORDER",
        product_id=product.id,
        category=product.category,
        metadata_info=f'{{"source": "ONDC_GATEWAY_PROTOTYPE", "quantity": {req.quantity}}}'
    ))

    db.commit()
    db.refresh(new_order)
    trigger_auto_pricing(product, db)

    return {
        "context": {"action": "on_confirm", "timestamp": datetime.now(timezone.utc).isoformat()},
        "message": {
            "order": {
                "id": f"ONDC_ORD_{new_order.id}",
                "state": "ACCEPTED",
                "fulfillment_status": "CONFIRMED",
                "items": [{"id": f"ARTISAN_PROD_{product.id}", "quantity": req.quantity}],
                "total_price": float(total_price)
            }
        }
    }
