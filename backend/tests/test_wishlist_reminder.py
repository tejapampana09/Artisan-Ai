import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from backend.app.models import User, Product, Event, Notification, Order
from backend.app.services.email_service import send_email, send_wishlist_reminder_email
from backend.app.services.wishlist_reminder import (
    get_pending_wishlist_reminders,
    process_wishlist_reminders
)


def test_email_service_mock_delivery():
    """Verify that email sending succeeds and gracefully mocks when SMTP is not configured."""
    res = send_wishlist_reminder_email(
        to_email="test.buyer@artisanai.in",
        buyer_name="Teja",
        product_title="Handcrafted Kalamkari Saree",
        product_price=4500.0,
        product_image_url="https://images.unsplash.com/photo-1610030469983-98e550d6193c",
        product_id=1,
        artisan_name="Lakshmi Devi",
        stock=3
    )
    assert res is True


def test_wishlist_reminder_pipeline(db: Session, client: TestClient):
    """
    Test the full 3-day Wishlist reminder pipeline:
    1. Create a buyer and product
    2. Record a SAVE event from 4 days ago
    3. Run the reminder process
    4. Verify Notification created and stats reported
    """
    # 1. Setup user
    buyer = User(
        name="Priya Sharma",
        email="priya.wishlist@test.com",
        role="BUYER",
        status="ACTIVE",
        hashed_password="hashed_pw_dummy"
    )
    db.add(buyer)
    db.commit()
    db.refresh(buyer)

    # 2. Setup product
    product = Product(
        title="Etikoppaka Wooden Toy Train",
        price=1200.0,
        stock=5,
        category="Wooden Toys",
        status="PUBLISHED"
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # 3. Add SAVE event from 4 days ago
    past_date = datetime.now(timezone.utc) - timedelta(days=4)
    save_event = Event(
        event_type="SAVE",
        user_id=buyer.id,
        product_id=product.id,
        category="Wooden Toys",
        timestamp=past_date
    )
    db.add(save_event)
    db.commit()

    # 4. Check eligible reminders
    pending = get_pending_wishlist_reminders(db, days_threshold=3)
    matching = [p for p in pending if p["user"].id == buyer.id and p["product"].id == product.id]
    assert len(matching) == 1

    # 5. Process reminders (dry run first)
    dry_result = process_wishlist_reminders(db, days_threshold=3, dry_run=True)
    assert dry_result["status"] == "ok"
    assert dry_result["eligible_count"] >= 1

    # 6. Process reminders (real execution)
    run_result = process_wishlist_reminders(db, days_threshold=3, dry_run=False)
    assert run_result["status"] == "ok"
    assert run_result["sent_count"] >= 1

    # Verify persistent in-app notification exists
    notif = db.query(Notification).filter(
        Notification.user_id == buyer.id,
        Notification.type == "WISHLIST_REMINDER"
    ).first()
    assert notif is not None
    assert "Etikoppaka Wooden Toy Train" in notif.title or "Etikoppaka Wooden Toy Train" in notif.message

    # Anti-spam verification: Running it again immediately should skip sending duplicate
    second_run = process_wishlist_reminders(db, days_threshold=3, dry_run=False)
    second_matching = [item for item in second_run["items"] if item["user_id"] == buyer.id and item["product_id"] == product.id]
    assert len(second_matching) == 0
