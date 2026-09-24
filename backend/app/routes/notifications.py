from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Notification, User
from backend.app.schemas import NotificationResponse
from backend.app.services.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notification Center"])

@router.get("", response_model=List[NotificationResponse])
def get_user_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch persistent notifications for current user."""
    notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).all()

    return [
        NotificationResponse(
            id=n.id,
            user_id=n.user_id,
            title=n.title,
            message=n.message,
            type=n.type,
            is_read=bool(n.is_read),
            created_at=n.created_at
        ) for n in notifs
    ]

@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marks a notification as read."""
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = 1
    db.commit()
    return {"status": "ok", "message": "Notification marked as read"}

from pydantic import BaseModel
from typing import Optional

class PushTokenRegisterRequest(BaseModel):
    push_token: str
    device_platform: Optional[str] = "android"

@router.post("/push-token")
def register_push_token(
    payload: PushTokenRegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Registers an Expo Push Token or FCM Device Token for the current user in AWS RDS."""
    token = (payload.push_token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Invalid push token")

    current_user.push_token = token
    db.commit()
    return {"status": "ok", "message": "Push token registered successfully", "user_id": current_user.id}


from backend.app.services.wishlist_reminder import (
    process_wishlist_reminders,
    get_pending_wishlist_reminders
)

@router.get("/wishlist-reminders/preview")
def preview_wishlist_reminders(
    days_threshold: int = 3,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Previews buyers with items saved >= `days_threshold` days ago
    who are eligible for follow-up reminders.
    """
    eligible = get_pending_wishlist_reminders(db, days_threshold=days_threshold)
    return {
        "days_threshold": days_threshold,
        "eligible_count": len(eligible),
        "candidates": [
            {
                "user_id": item["user"].id,
                "user_name": item["user"].name,
                "email": item["user"].email,
                "product_id": item["product"].id,
                "product_title": item["product"].title,
                "product_price": item["product"].price,
                "stock": item["product"].stock,
                "saved_at": item["saved_at"]
            }
            for item in eligible
        ]
    }


@router.post("/wishlist-reminders/run")
def trigger_wishlist_reminders(
    days_threshold: int = 3,
    dry_run: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Triggers the 3-day Wishlist Email & Push Notification Recovery Follow-up.
    Can be scheduled via cron or triggered directly by Admin.
    """
    result = process_wishlist_reminders(db, days_threshold=days_threshold, dry_run=dry_run)
    return result

