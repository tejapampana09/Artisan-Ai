"""
ONDC Participant / Subscriber Public Key Registry.
Resolves and caches Ed25519 signing public keys for network participants (BAPs, Gateways)
to enable production-safe inbound HTTP signature verification.
"""

import time
import logging
from typing import Dict, Optional, Tuple, Any
import httpx

from backend.app.integrations.ondc.config import ONDCConfig

logger = logging.getLogger("artisan_ai.ondc.registry")

class ONDCSubscriberRegistry:
    """
    In-memory registry and lookup client for ONDC network participants.
    Resolves participant public keys by (subscriber_id, unique_key_id).
    """

    def __init__(self, config: Optional[ONDCConfig] = None, ttl_seconds: int = 3600):
        self.config = config
        self.ttl_seconds = ttl_seconds
        # Cache structure: (subscriber_id, unique_key_id) -> (public_key_b64, expiry_timestamp)
        self._cache: Dict[Tuple[str, str], Tuple[str, float]] = {}
        # Pre-configured trusted participants (e.g., test harnesses or known staging gateways)
        self._trusted: Dict[Tuple[str, str], str] = {}

    def set_config(self, config: ONDCConfig):
        self.config = config

    def register_trusted_participant(
        self,
        subscriber_id: str,
        unique_key_id: str,
        public_key_b64: str
    ):
        """Manually registers a trusted participant's public key (e.g. for staging or tests)."""
        clean_sub = subscriber_id.strip()
        clean_key = unique_key_id.strip()
        clean_pub = public_key_b64.strip()
        self._trusted[(clean_sub, clean_key)] = clean_pub
        self._cache[(clean_sub, clean_key)] = (clean_pub, time.time() + self.ttl_seconds)
        logger.info("Registered trusted ONDC participant '%s' (keyId '%s')", clean_sub, clean_key)

    def get_cached_public_key(self, subscriber_id: str, unique_key_id: str) -> Optional[str]:
        """Returns cached or preconfigured public key if still valid."""
        clean_sub = subscriber_id.strip()
        clean_key = unique_key_id.strip()

        # Check self-identity if configured (allows self-signed verification in tests)
        if self.config and self.config.subscriber_id == clean_sub:
            if self.config.public_key:
                return self.config.public_key

        # Check trusted list
        if (clean_sub, clean_key) in self._trusted:
            return self._trusted[(clean_sub, clean_key)]

        # Check TTL cache
        cached = self._cache.get((clean_sub, clean_key))
        if cached:
            pub_key, expires_at = cached
            if time.time() < expires_at:
                return pub_key
            else:
                self._cache.pop((clean_sub, clean_key), None)

        return None

    async def lookup_public_key(
        self,
        subscriber_id: str,
        unique_key_id: str,
        domain: Optional[str] = None
    ) -> Optional[str]:
        """
        Resolves a participant's public key:
        1. Checks in-memory cache and trusted list
        2. If network lookup is available, queries ONDC Registry /lookup endpoint
        3. Caches result if found
        """
        cached = self.get_cached_public_key(subscriber_id, unique_key_id)
        if cached:
            return cached

        # Check if gateway/registry URL is configured for live network lookup
        lookup_url = getattr(self.config, "registry_url", None) or getattr(self.config, "gateway_url", None)
        if not lookup_url or "placeholder" in lookup_url.lower():
            logger.debug(
                "Network lookup skipped for subscriber '%s' (no active registry URL configured)",
                subscriber_id
            )
            return None

        # Live Beckn POST /lookup
        endpoint = f"{lookup_url.rstrip('/')}/lookup"
        lookup_payload = {
            "subscriber_id": subscriber_id,
            "type": "bap",
            "domain": domain or (self.config.domain if self.config else "ONDC:RET12")
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(endpoint, json=lookup_payload)
                if res.status_code == 200:
                    data = res.json()
                    # ONDC Registry returns a list of matching participant records
                    if isinstance(data, list):
                        for entry in data:
                            if entry.get("subscriber_id") == subscriber_id:
                                signing_key = entry.get("signing_public_key")
                                if signing_key:
                                    self._cache[(subscriber_id, unique_key_id)] = (
                                        signing_key,
                                        time.time() + self.ttl_seconds
                                    )
                                    return signing_key
        except Exception as exc:
            logger.warning("ONDC registry lookup failed for subscriber '%s': %s", subscriber_id, exc)

        return None

    def clear(self):
        """Clears volatile cache (preserves trusted participants)."""
        self._cache.clear()


# Global registry resolver instance
ondc_registry = ONDCSubscriberRegistry()
