import uuid
import hmac
import hashlib
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Order, Payment, Product, User, Notification
from backend.app.services.push_notifications import create_and_dispatch_notification
from backend.app.schemas import (
    PaymentCreateRequest,
    PaymentVerifyRequest,
    PaymentResponse
)
from backend.app.services.auth import require_buyer
from backend.app.config import ENVIRONMENT

router = APIRouter(prefix="/api/marketplace/payments", tags=["Marketplace Payments"])

@router.post("/create", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(
    payload: PaymentCreateRequest,
    db: Session = Depends(get_db),
    current_buyer: User = Depends(require_buyer)
):
    """
    Step 1 of Payment Flow:
    Initializes a server-authoritative Payment entity for an existing Order.
    Enforces Order = PENDING_PAYMENT, Payment = CREATED.
    """
    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order #{payload.order_id} not found."
        )

    if order.user_id != current_buyer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You may only initiate payment for your own orders."
        )

    if order.status == "CONFIRMED" and order.payment_status == "VERIFIED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order #{order.id} is already confirmed and paid."
        )

    # Idempotency check
    if payload.idempotency_key:
        existing_pmt = db.query(Payment).filter(
            Payment.idempotency_key == payload.idempotency_key
        ).first()
        if existing_pmt:
            return existing_pmt

    provider = (payload.provider or "COD").upper().strip()
    if provider not in ["COD", "RAZORPAY"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Online payments are not enabled yet. Please choose Cash on Delivery (COD)."
        )
    provider_order_id = f"order_{provider.lower()}_{uuid.uuid4().hex[:14]}"

    payment = Payment(
        order_id=order.id,
        provider=provider,
        provider_order_id=provider_order_id,
        amount=order.total_price,
        currency="INR",
        status="CREATED",
        signature_verified=False,
        idempotency_key=payload.idempotency_key,
        created_at=datetime.now(timezone.utc)
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment

@router.post("/verify", response_model=PaymentResponse)
def verify_payment(
    payload: PaymentVerifyRequest,
    db: Session = Depends(get_db),
    current_buyer: User = Depends(require_buyer)
):
    """
    Step 2 of Payment Flow:
    Server-authoritative, idempotent payment verification.
    Verifies payment signature / transaction state against order amount.
    Transitions Payment -> VERIFIED and Order -> CONFIRMED.
    """
    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order #{payload.order_id} not found."
        )

    if order.user_id != current_buyer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You may only verify payments for your own orders."
        )

    payment = db.query(Payment).filter(
        Payment.order_id == order.id
    ).order_by(Payment.id.desc()).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No payment initiation found for Order #{order.id}. Call /create first."
        )

    # Idempotency: If already verified, return successfully without duplicating side effects
    if payment.status == "VERIFIED" and order.status == "CONFIRMED":
        return payment

    provider = (payload.provider or payment.provider or "RAZORPAY").upper().strip()
    if payment.provider.upper().strip() != provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment provider mismatch: payment was initialized with {payment.provider}, cannot verify with {provider}."
        )

    # Validate amount and currency if supplied in payload
    if payload.amount is not None:
        try:
            req_amount = Decimal(str(payload.amount)).quantize(Decimal("0.01"))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid payment amount format."
            )
        if req_amount != payment.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment amount mismatch: expected {payment.amount}, received {req_amount}."
            )

    if payload.currency is not None:
        if payload.currency.upper().strip() != payment.currency.upper().strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment currency mismatch: expected {payment.currency}, received {payload.currency}."
            )

    verified = False
    provider_payment_id = payload.provider_payment_id

    if provider == "COD":
        # Cash on delivery verification
        verified = True
        provider_payment_id = provider_payment_id or f"cod_{uuid.uuid4().hex[:10]}"
    elif provider == "RAZORPAY":
        if not payload.provider_payment_id or not payload.signature:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Razorpay payment verification requires provider_payment_id and signature."
            )

        # Anti-Replay: Verify provider_order_id matches the one generated and bound to this payment
        if payload.provider_order_id and payload.provider_order_id != payment.provider_order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provider order ID does not match the payment order record."
            )

        order_id_to_sign = payload.provider_order_id or payment.provider_order_id

        from backend.app.config import RAZORPAY_KEY_SECRET, ENVIRONMENT
        if RAZORPAY_KEY_SECRET:
            # Cryptographic HMAC-SHA256 signature verification
            expected_signature = hmac.new(
                key=RAZORPAY_KEY_SECRET.encode("utf-8"),
                msg=f"{order_id_to_sign}|{payload.provider_payment_id}".encode("utf-8"),
                digestmod=hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(expected_signature, payload.signature):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Razorpay payment signature."
                )
            verified = True
        else:
            if ENVIRONMENT == "production":
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Payment gateway is not configured for production verification."
                )
            # In test/dev environments without real Razorpay secret, accept test signatures
            verified = True
    elif provider in ["UPI_QR", "UPI", "CARD", "NETBANKING"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Online payments are not enabled yet."
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported payment provider: {provider}"
        )

    if not verified:
        payment.status = "FAILED"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment verification failed: invalid provider signature or transaction state."
        )

    # Successful Server-Authoritative State Transition
    payment.status = "VERIFIED"
    payment.signature_verified = True
    payment.provider_payment_id = provider_payment_id
    payment.verified_at = datetime.now(timezone.utc)

    order.status = "CONFIRMED"
    order.payment_status = "VERIFIED"
    order.payment_tx_id = provider_payment_id
    db.commit()
    db.refresh(payment)
    db.refresh(order)

    # Dispatch confirmation notifications & push alerts
    product = order.product
    if product and product.seller_id:
        create_and_dispatch_notification(
            db=db,
            user_id=product.seller_id,
            title="🛒 New Verified Order Received!",
            message=f"{order.buyer_name} ordered '{product.title}' × {order.quantity} unit(s) (₹{float(order.total_price):,.0f}). Payment verified.",
            type="ORDER",
            data={"order_id": order.id, "product_id": product.id, "role": "seller"}
        )
    create_and_dispatch_notification(
        db=db,
        user_id=current_buyer.id,
        title="✅ Order Confirmed & Paid!",
        message=f"Your order for '{product.title if product else 'Artisan Craft'}' × {order.quantity} (₹{float(order.total_price):,.0f}) is confirmed and paid.",
        type="ORDER",
        data={"order_id": order.id, "role": "buyer"}
    )
    db.commit()

    return payment
