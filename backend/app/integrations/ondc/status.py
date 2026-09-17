"""
ONDC Connectivity Health and Metrics Tracker.
Maintains honest diagnostic telemetry regarding participant configuration,
signing readiness, protocol interaction timestamps, and network verification.

RULE: Never report 'VERIFIED' or 'CONNECTED' without an actual successful
cryptographically-verified ONDC network interaction.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from threading import Lock
from backend.app.integrations.ondc.config import ONDCConfig

class ONDCStatusTracker:
    def __init__(self):
        self._lock = Lock()
        self.last_protocol_interaction: Optional[datetime] = None
        self.last_successful_search: Optional[datetime] = None
        self.last_error: Optional[str] = None
        self.last_error_time: Optional[datetime] = None
        self.recent_errors: List[Dict[str, Any]] = []
        self.total_searches_received: int = 0
        self.total_callbacks_sent: int = 0
        self.total_callbacks_failed: int = 0
        self.verified_live_interaction: bool = False

    def record_search_received(self):
        with self._lock:
            now = datetime.now(timezone.utc)
            self.last_protocol_interaction = now
            self.total_searches_received += 1

    def record_search_success(self):
        with self._lock:
            now = datetime.now(timezone.utc)
            self.last_protocol_interaction = now
            self.last_successful_search = now

    def record_callback_success(self):
        with self._lock:
            now = datetime.now(timezone.utc)
            self.last_protocol_interaction = now
            self.total_callbacks_sent += 1
            self.verified_live_interaction = True

    def record_error(self, error_message: str):
        with self._lock:
            now = datetime.now(timezone.utc)
            self.last_error = error_message
            self.last_error_time = now
            self.total_callbacks_failed += 1
            self.recent_errors.insert(0, {
                "timestamp": now.isoformat(),
                "error": error_message
            })
            if len(self.recent_errors) > 10:
                self.recent_errors = self.recent_errors[:10]

    def get_status_report(self, config: ONDCConfig) -> Dict[str, Any]:
        with self._lock:
            if self.verified_live_interaction:
                verification_state = "VERIFIED"
            elif config.is_subscriber_configured and config.is_signing_configured:
                verification_state = "CONFIGURED - NOT VERIFIED"
            else:
                verification_state = "NOT CONFIGURED"

            return {
                "environment": config.environment.upper(),
                "subscriber_id": config.subscriber_id,
                "subscriber_configured": config.is_subscriber_configured,
                "credentials_configured": config.is_signing_configured,
                "signing_configured": config.is_signing_configured,
                "gateway_configured": config.is_gateway_configured,
                "domain": config.domain,
                "supported_domains": config.supported_domains,
                "city": config.city,
                "country": config.country,
                "core_version": config.core_version,
                "enforce_auth": config.enforce_auth,
                "auth_mode": "ENFORCED (Staging/Production)" if config.enforce_auth else "PERMISSIVE (Local/Hackathon Development)",
                "verification_status": verification_state,
                "verified_live_interaction": self.verified_live_interaction,
                "demo_statement": "ONDC Retail seller-side discoverability foundation implemented; live network verification pending participant onboarding.",
                "last_protocol_interaction": self.last_protocol_interaction.isoformat() if self.last_protocol_interaction else None,
                "last_successful_search": self.last_successful_search.isoformat() if self.last_successful_search else None,
                "last_error": self.last_error,
                "last_error_time": self.last_error_time.isoformat() if self.last_error_time else None,
                "total_searches_received": self.total_searches_received,
                "total_callbacks_sent": self.total_callbacks_sent,
                "total_callbacks_failed": self.total_callbacks_failed,
                "recent_errors": list(self.recent_errors),
            }


# Singleton status tracker
ondc_status_tracker = ONDCStatusTracker()
