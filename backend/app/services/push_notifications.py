import asyncio
import logging
from typing import Optional, Dict, Any
import httpx
from sqlalchemy.orm import Session

from backend.app.config import FCM_SERVER_KEY, FIREBASE_PROJECT_ID
from backend.app.models import Notification, User

logger = logging.getLogger("artisan_ai.push_notifications")


async def send_push_notification(
    push_token: Optional[str],
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    channel_id: str = "orders_channel"
) -> bool:
    """
    Sends a push notification to a device token via Expo Push API or Google FCM.
    Safe, non-blocking, and handles delivery failures gracefully.
    """
    if not push_token or not push_token.strip():
        return False

    token = push_token.strip()

    # 1. Expo Push Token format: ExponentPushToken[...] or ExpoPushToken[...]
    if token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken["):
        url = "https://exp.host/--/api/v2/push/send"
        payload = {
            "to": token,
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default",
            "priority": "high",
            "channelId": channel_id,
            "_displayInForeground": True
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                if res.status_code == 200:
                    logger.info("[Push] Expo push notification delivered successfully to %s", token[:25])
                    return True
                logger.warning("[Push] Expo push returned HTTP %s: %s", res.status_code, res.text)
        except Exception as e:
            logger.warning("[Push] Failed to send Expo push notification: %s", e)
        return False

    # 2. Native FCM Token (e.g. standard Android FCM device token)
    if FCM_SERVER_KEY:
        url = "https://fcm.googleapis.com/fcm/send"
        payload = {
            "to": token,
            "notification": {
                "title": title,
                "body": body,
                "sound": "default",
                "android_channel_id": channel_id
            },
            "data": data or {},
            "priority": "high"
        }
        headers = {
            "Authorization": f"key={FCM_SERVER_KEY}",
            "Content-Type": "application/json"
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    logger.info("[Push] FCM push notification delivered successfully to %s", token[:25])
                    return True
                logger.warning("[Push] FCM push returned HTTP %s: %s", res.status_code, res.text)
        except Exception as e:
            logger.warning("[Push] Failed to send FCM push: %s", e)

    return False


def dispatch_push_in_background(
    push_token: Optional[str],
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    channel_id: str = "orders_channel"
):
    """
    Safely fires the async push notification task in background without awaiting.
    """
    if not push_token:
        return
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(send_push_notification(push_token, title, body, data, channel_id))
    except RuntimeError:
        import threading
        def _runner():
            asyncio.run(send_push_notification(push_token, title, body, data, channel_id))
        t = threading.Thread(target=_runner, daemon=True)
        t.start()


def create_and_dispatch_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    type: str = "GENERAL",
    data: Optional[Dict[str, Any]] = None
) -> Notification:
    """
    Unified Notification Dispatcher:
    1. Persists Notification in RDS PostgreSQL / SQLite.
    2. Queries recipient's registered push_token.
    3. Fires real-time push notification (Expo / FCM) to user's phone.
    """
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        is_read=0
    )
    db.add(notif)
    db.flush()

    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.push_token:
            payload_data = dict(data or {})
            payload_data.setdefault("notification_id", notif.id)
            payload_data.setdefault("type", type)
            dispatch_push_in_background(
                push_token=user.push_token,
                title=title,
                body=message,
                data=payload_data,
                channel_id="orders_channel" if "ORDER" in type.upper() else "artisan_general"
            )
    except Exception as err:
        logger.warning("[Push] Error dispatching push notification for user %s: %s", user_id, err)

    return notif
