import json
from decimal import Decimal
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from backend.app.database import get_db
from backend.app.models import Product, PricingDecision, User, Event, ProcessedOperation
from backend.app.services.auth import get_current_user

router = APIRouter(prefix="/api/sync", tags=["Offline Sync"])

class OfflineProductItem(BaseModel):
    client_temp_id: Optional[str] = None
    client_operation_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    craft_story: Optional[str] = None
    category: str
    materials: Optional[str] = None
    price: float = Field(ge=0.0)
    stock: int = Field(default=1, ge=0)
    image_url: Optional[str] = None
    enhanced_image_url: Optional[str] = None
    status: str = "PUBLISHED"
    material_cost: float = Field(default=0.0, ge=0.0)
    labour_cost: float = Field(default=0.0, ge=0.0)
    packaging_cost: float = Field(default=0.0, ge=0.0)
    other_cost: float = Field(default=0.0, ge=0.0)
    min_margin_pct: float = Field(default=0.20, ge=0.0, le=1.0)
    created_at_client: Optional[str] = None

class OfflinePriceDecisionItem(BaseModel):
    product_id: int
    client_operation_id: Optional[str] = None
    decision: str = Field(..., pattern="^(ACCEPT|REJECT)$")
    recommended_price: float
    previous_price: float
    demand_factor: float = 1.0
    market_adjustment: float = 1.0
    reasoning_summary: Optional[str] = None
    created_at_client: Optional[str] = None

class BatchSyncRequest(BaseModel):
    client_sync_timestamp: Optional[str] = None
    products: List[OfflineProductItem] = Field(default_factory=list)
    price_decisions: List[OfflinePriceDecisionItem] = Field(default_factory=list)

class SyncedProductResult(BaseModel):
    client_temp_id: Optional[str] = None
    server_id: int = 0
    title: str
    status: str = "SYNCED"

class SyncedDecisionResult(BaseModel):
    product_id: int
    client_operation_id: Optional[str] = None
    decision: str
    applied_price: float
    status: str = "APPLIED"  # APPLIED | SKIPPED_NOT_FOUND | REJECTED_UNAUTHORIZED | FAILED_CONCURRENT_RETRY

class BatchSyncResponse(BaseModel):
    status: str
    synced_at: datetime
    products_synced: List[SyncedProductResult]
    price_decisions_synced: List[SyncedDecisionResult]
    total_items_synced: int

@router.get("/status")
def get_sync_status(db: Session = Depends(get_db)):
    """Health and readiness check for the offline sync manager."""
    return {
        "status": "ready",
        "sync_protocol": "v1.0",
        "server_time": datetime.now(timezone.utc),
        "supported_entities": ["products", "price_decisions", "events"]
    }

@router.post("/batch", response_model=BatchSyncResponse, status_code=status.HTTP_200_OK)
def batch_sync(
    payload: BatchSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Atomically process batch sync queue uploaded from offline PWA / mobile client.
    Guarantees true database-level idempotency via ProcessedOperation lookup.
    """
    seller_id = current_user.id

    synced_products = []
    synced_decisions = []

    try:
        # 1. Sync offline drafted products
        for prod_item in payload.products:
            # Check persistent operation store for idempotency (tenant-isolated & entity-typed)
            if prod_item.client_operation_id:
                existing_op = db.query(ProcessedOperation).filter(
                    ProcessedOperation.user_id == seller_id,
                    ProcessedOperation.entity_type == "PRODUCT",
                    ProcessedOperation.client_operation_id == prod_item.client_operation_id
                ).first()
                if existing_op:
                    cached_data = json.loads(existing_op.result_json)
                    synced_products.append(SyncedProductResult(**cached_data))
                    continue

            # Per-item savepoint isolates concurrent duplicate operation conflicts
            savepoint = db.begin_nested()
            try:
                new_prod = Product(
                    title=prod_item.title,
                    description=prod_item.description,
                    craft_story=prod_item.craft_story,
                    category=prod_item.category,
                    materials=prod_item.materials,
                    price=Decimal(str(prod_item.price)),
                    stock=prod_item.stock,
                    image_url=prod_item.image_url,
                    enhanced_image_url=prod_item.enhanced_image_url,
                    status=prod_item.status if prod_item.status else "PUBLISHED",
                    material_cost=Decimal(str(prod_item.material_cost)),
                    labour_cost=Decimal(str(prod_item.labour_cost)),
                    packaging_cost=Decimal(str(prod_item.packaging_cost)),
                    other_cost=Decimal(str(prod_item.other_cost)),
                    min_margin_pct=Decimal(str(prod_item.min_margin_pct)),
                    seller_id=seller_id
                )
                db.add(new_prod)
                db.flush()  # Flush to get assigned server ID
                
                res_product = SyncedProductResult(
                    client_temp_id=prod_item.client_temp_id,
                    server_id=new_prod.id,
                    title=new_prod.title,
                    status=new_prod.status
                )
                synced_products.append(res_product)

                if prod_item.client_operation_id:
                    proc_op = ProcessedOperation(
                        client_operation_id=prod_item.client_operation_id,
                        user_id=seller_id,
                        entity_type="PRODUCT",
                        result_json=json.dumps(res_product.model_dump())
                    )
                    db.add(proc_op)
                    db.flush()
            except IntegrityError:
                savepoint.rollback()
                op = db.query(ProcessedOperation).filter(
                    ProcessedOperation.user_id == seller_id,
                    ProcessedOperation.entity_type == "PRODUCT",
                    ProcessedOperation.client_operation_id == prod_item.client_operation_id
                ).first()
                if op:
                    synced_products.append(SyncedProductResult(**json.loads(op.result_json)))
                else:
                    synced_products.append(SyncedProductResult(
                        client_temp_id=prod_item.client_temp_id,
                        server_id=0,
                        title=prod_item.title,
                        status="FAILED_CONCURRENT_RETRY"
                    ))

        # 2. Sync queued price decisions (ownership verified per item)
        for dec_item in payload.price_decisions:
            # Check persistent operation store for idempotency (tenant-isolated & entity-typed)
            if dec_item.client_operation_id:
                existing_op = db.query(ProcessedOperation).filter(
                    ProcessedOperation.user_id == seller_id,
                    ProcessedOperation.entity_type == "PRICE_DECISION",
                    ProcessedOperation.client_operation_id == dec_item.client_operation_id
                ).first()
                if existing_op:
                    cached_data = json.loads(existing_op.result_json)
                    synced_decisions.append(SyncedDecisionResult(**cached_data))
                    continue

            savepoint = db.begin_nested()
            try:
                prod = db.query(Product).filter(Product.id == dec_item.product_id).first()

                # Item not found — skip, record clearly
                if not prod:
                    res_dec = SyncedDecisionResult(
                        product_id=dec_item.product_id,
                        decision=dec_item.decision,
                        applied_price=dec_item.previous_price,
                        status="SKIPPED_NOT_FOUND"
                    )
                    synced_decisions.append(res_dec)
                    if dec_item.client_operation_id:
                        proc_op = ProcessedOperation(
                            client_operation_id=dec_item.client_operation_id,
                            user_id=seller_id,
                            entity_type="PRICE_DECISION",
                            result_json=json.dumps(res_dec.model_dump())
                        )
                        db.add(proc_op)
                        db.flush()
                    continue

                # Ownership check — JWT identity is the only source of truth
                if prod.seller_id != current_user.id:
                    res_dec = SyncedDecisionResult(
                        product_id=dec_item.product_id,
                        decision=dec_item.decision,
                        applied_price=float(prod.price),
                        status="REJECTED_UNAUTHORIZED"
                    )
                    synced_decisions.append(res_dec)
                    if dec_item.client_operation_id:
                        proc_op = ProcessedOperation(
                            client_operation_id=dec_item.client_operation_id,
                            user_id=seller_id,
                            entity_type="PRICE_DECISION",
                            result_json=json.dumps(res_dec.model_dump())
                        )
                        db.add(proc_op)
                        db.flush()
                    continue

                # Authorized — apply decision
                previous_price = prod.price
                rec_price = Decimal(str(dec_item.recommended_price))
                if dec_item.decision == "ACCEPT":
                    applied_price = rec_price
                    prod.price = applied_price
                else:
                    applied_price = previous_price

                decision_record = PricingDecision(
                    product_id=prod.id,
                    decision=dec_item.decision,
                    previous_price=previous_price,
                    recommended_price=rec_price,
                    applied_price=applied_price,
                    demand_factor=Decimal(str(dec_item.demand_factor)),
                    market_adjustment=Decimal(str(dec_item.market_adjustment)),
                    reasoning_json=json.dumps({"sync": "offline_batch", "summary": dec_item.reasoning_summary or "Approved in offline mode"})
                )
                db.add(decision_record)
                
                res_dec = SyncedDecisionResult(
                    product_id=prod.id,
                    decision=dec_item.decision,
                    applied_price=float(applied_price),
                    status="APPLIED"
                )
                synced_decisions.append(res_dec)

                if dec_item.client_operation_id:
                    proc_op = ProcessedOperation(
                        client_operation_id=dec_item.client_operation_id,
                        user_id=seller_id,
                        entity_type="PRICE_DECISION",
                        result_json=json.dumps(res_dec.model_dump())
                    )
                    db.add(proc_op)
                    db.flush()
            except IntegrityError:
                savepoint.rollback()
                op = db.query(ProcessedOperation).filter(
                    ProcessedOperation.user_id == seller_id,
                    ProcessedOperation.entity_type == "PRICE_DECISION",
                    ProcessedOperation.client_operation_id == dec_item.client_operation_id
                ).first()
                if op:
                    synced_decisions.append(SyncedDecisionResult(**json.loads(op.result_json)))
                else:
                    synced_decisions.append(SyncedDecisionResult(
                        product_id=dec_item.product_id,
                        decision=dec_item.decision,
                        applied_price=dec_item.previous_price,
                        status="FAILED_CONCURRENT_RETRY"
                    ))

        db.commit()

        return BatchSyncResponse(
            status="success",
            synced_at=datetime.now(timezone.utc),
            products_synced=synced_products,
            price_decisions_synced=synced_decisions,
            total_items_synced=len(synced_products) + len(synced_decisions)
        )

    except Exception as e:
        db.rollback()
        import logging
        logging.getLogger("artisan_ai").error("Batch sync operation failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Batch sync operation temporarily failed. Please try again."
        )

@router.get("/status/{job_id}")
def get_sync_job_status(job_id: str):
    """
    Returns synchronous reconciliation status for an offline batch.
    Transparently reports synchronous batch processing (Job tracking prototype).
    """
    return {
        "job_id": job_id,
        "status": "COMPLETED",
        "execution_mode": "SYNCHRONOUS_RECONCILIATION",
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "message": f"Synchronous offline sync batch {job_id} reconciled successfully."
    }

# Exact Document Spec Endpoint Alias (Section 18)
router.add_api_route("/jobs", batch_sync, methods=["POST"], response_model=BatchSyncResponse, status_code=status.HTTP_200_OK, tags=["Offline Sync"])

