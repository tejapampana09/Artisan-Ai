"""
ONDC Idempotency & Replay Attack Protection.
Provides in-memory TTL caching for Beckn message_id and transaction_id
to prevent duplicate message execution or replay attacks.
"""

import time
from typing import Dict, Tuple
from threading import Lock

class ONDCIdempotencyTracker:
    def __init__(self, ttl_seconds: int = 600):
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, float] = {}
        self._lock = Lock()

    def _cleanup_expired(self, now: float):
        expired = [k for k, exp in self._cache.items() if exp <= now]
        for k in expired:
            del self._cache[k]

    def is_duplicate(self, message_id: str, transaction_id: str = "") -> bool:
        """Checks if a message_id has already been processed within the TTL window."""
        if not message_id:
            return False

        key = f"{transaction_id}:{message_id}" if transaction_id else message_id
        now = time.time()
        with self._lock:
            self._cleanup_expired(now)
            if key in self._cache and self._cache[key] > now:
                return True
            return False

    def record(self, message_id: str, transaction_id: str = ""):
        """Records a processed message_id with expiration timestamp."""
        if not message_id:
            return

        key = f"{transaction_id}:{message_id}" if transaction_id else message_id
        now = time.time()
        with self._lock:
            self._cleanup_expired(now)
            self._cache[key] = now + self.ttl_seconds

    def clear(self):
        """Clears the cache (used in testing)."""
        with self._lock:
            self._cache.clear()


# Global idempotency tracker
ondc_idempotency = ONDCIdempotencyTracker()
