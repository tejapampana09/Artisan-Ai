import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from backend.app.models import Event, Product, User, Order, Notification
from backend.app.services.push_notifications import create_and_dispatch_notification
from backend.app.services.email_service import send_wishlist_reminder_email

logger = logging.getLogger("artisan_ai.wishlist_reminder")


def get_pending_wishlist_reminders(
    db: Session,
    days_threshold: int = 3
) -> List[Dict[str, Any]]:
    """
    Scans for wishlisted items saved at least `days_threshold` days ago
    where the product is still in stock, hasn't been purchased yet,
    and hasn't received a reminder in the last 7 days.
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_threshold)
    recent_reminder_cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    # 1. Fetch eligible SAVE events
    save_events = (
        db.query(Event)
        .filter(
            Event.event_type == "SAVE",
            Event.user_id.isnot(None),
            Event.product_id.isnot(None),
            Event.timestamp <= cutoff_date
        )
        .order_by(Event.timestamp.desc())
        .all()
    )

    seen_pairs = set()
    eligible = []

    for evt in save_events:
        pair_key = (evt.user_id, evt.product_id)
        if pair_key in seen_pairs:
            continue
        seen_pairs.add(pair_key)

        user = db.query(User).filter(User.id == evt.user_id).first()
        product = db.query(Product).filter(Product.id == evt.product_id).first()

        if not user or not product:
            continue

        # Must have stock
        if (product.stock or 0) <= 0:
            continue

        # Check if buyer already bought this product
        already_ordered = (
            db.query(Order.id)
            .filter(
                Order.user_id == user.id,
                Order.product_id == product.id
            )
            .first()
        )
        if already_ordered:
            continue

        # Anti-spam check: check if reminder already sent in last 7 days
        already_reminded = (
            db.query(Notification.id)
            .filter(
                Notification.user_id == user.id,
                Notification.type == "WISHLIST_REMINDER",
                Notification.created_at >= recent_reminder_cutoff,
                (Notification.title.like(f"%{product.title[:20]}%") | Notification.message.like(f"%{product.title[:20]}%"))
            )
            .first()
        )
        if already_reminded:
            continue

        # Get seller name if available
        seller_name = None
        if product.seller_id:
            seller = db.query(User).filter(User.id == product.seller_id).first()
            if seller:
                seller_name = seller.name

        eligible.append({
            "event_id": evt.id,
            "saved_at": evt.timestamp,
            "user": user,
            "product": product,
            "seller_name": seller_name or product.category or "Master Artisan"
        })

    return eligible


def process_wishlist_reminders(
    db: Session,
    days_threshold: int = 3,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Executes the automated 3-day Wishlist recovery follow-up pipeline.
    Dispatches:
      1. In-App Notification Center Alert
      2. Native Push Notification (FCM / Expo)
      3. Branded HTML Email
    """
    eligible_items = get_pending_wishlist_reminders(db, days_threshold=days_threshold)
    sent_count = 0
    errors_count = 0

    results = []

    for item in eligible_items:
        user = item["user"]
        product = item["product"]
        artisan_label = item["seller_name"]

        if dry_run:
            results.append({
                "user_id": user.id,
                "email": user.email,
                "product_id": product.id,
                "product_title": product.title,
                "status": "DRY_RUN_ELIGIBLE"
            })
            continue

        try:
            # 1. In-app & Push Notification
            notif_title = f"Still interested in {product.title[:30]}?"
            notif_body = (
                f"Your saved craft '{product.title}' from {artisan_label} is still in stock "
                f"({product.stock} left at ₹{product.price:,.0f}). Complete your order to support this artisan!"
            )

            create_and_dispatch_notification(
                db=db,
                user_id=user.id,
                title=notif_title,
                message=notif_body,
                type="WISHLIST_REMINDER",
                data={
                    "product_id": product.id,
                    "action": "OPEN_PRODUCT",
                    "deep_link": f"/#craft-{product.id}"
                }
            )

            # 2. Email Follow-up
            email_sent = False
            if user.email and "@" in user.email:
                email_sent = send_wishlist_reminder_email(
                    to_email=user.email,
                    buyer_name=user.name,
                    product_title=product.title,
                    product_price=product.price,
                    product_image_url=product.image_url,
                    product_id=product.id,
                    artisan_name=artisan_label,
                    stock=product.stock or 1
                )

            sent_count += 1
            results.append({
                "user_id": user.id,
                "user_name": user.name,
                "email": user.email,
                "product_id": product.id,
                "product_title": product.title,
                "in_app_notif": True,
                "email_sent": email_sent,
                "status": "SENT"
            })
        except Exception as e:
            logger.error("[WishlistReminder] Failed sending reminder for user %s: %s", user.id, e)
            errors_count += 1

    if not dry_run:
        db.commit()

    return {
        "status": "ok",
        "dry_run": dry_run,
        "days_threshold": days_threshold,
        "eligible_count": len(eligible_items),
        "sent_count": sent_count,
        "errors_count": errors_count,
        "items": results
    }
