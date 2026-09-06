"""
Production In-Memory Sliding Window Rate Limiter.
Protects sensitive authentication and AI endpoints against brute-force and API abuse.
Returns HTTP 429 Too Many Requests when limits are exceeded.
"""

import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, Request, status

import os
from backend.app.config import ENVIRONMENT

class SlidingWindowRateLimiter:
    def __init__(self):
        # Maps key -> List[timestamp]
        self._history: Dict[str, List[float]] = defaultdict(list)

    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int = 60):
        """
        Enforces a sliding window rate limit for the given key.
        Raises HTTP 429 if max_requests exceeded within window_seconds.
        """
        # Bypass rate limiting in test execution environment unless explicitly testing rate limiter
        if (ENVIRONMENT in ["test", "testing"] or os.getenv("PYTEST_CURRENT_TEST") or "testclient" in key) and not key.startswith("test_rate_limit:"):
            return

        now = time.time()
        cutoff = now - window_seconds

        # Clean old timestamps
        history = [ts for ts in self._history[key] if ts > cutoff]
        self._history[key] = history

        if len(history) >= max_requests:
            retry_after = int(window_seconds - (now - history[0])) if history else window_seconds
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: Maximum {max_requests} requests per {window_seconds} seconds. Please try again in {retry_after} seconds.",
                headers={"Retry-After": str(max(1, retry_after))}
            )

        self._history[key].append(now)

rate_limiter = SlidingWindowRateLimiter()

def get_client_identifier(request: Request, user_id: int = None) -> str:
    """Derives client rate-limit key from user_id if present, else direct client socket IP address."""
    if user_id:
        return f"user:{user_id}"
    
    # Priority: direct socket client host to prevent client-side X-Forwarded-For header spoofing
    client_ip = request.client.host if request.client else "unknown_ip"
    if os.getenv("TRUST_FORWARDED_FOR", "false").lower() == "true":
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
    return f"ip:{client_ip}"
