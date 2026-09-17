"""
ONDC Outbound Protocol Client.
Dispatches signed Beckn callbacks (e.g. on_search) to Buyer Applications (BAP) or Gateways.
"""

import json
import logging
import httpx
from typing import Dict, Any, Optional

from backend.app.integrations.ondc.config import ONDCConfig
from backend.app.integrations.ondc.signing import sign_request, ONDCSigningError
from backend.app.integrations.ondc.status import ondc_status_tracker

logger = logging.getLogger("artisan_ai.ondc.client")

class ONDCClient:
    def __init__(self, config: ONDCConfig):
        self.config = config

    async def send_on_search_callback(
        self,
        bap_uri: str,
        payload: Dict[str, Any]
    ) -> bool:
        """
        Sends an asynchronous on_search callback payload to the requesting BAP.
        Attaches Ed25519 signature headers if credentials are configured.
        Updates status metrics accordingly.
        """
        if not bap_uri:
            err = "Cannot dispatch on_search callback: Missing bap_uri in request context"
            logger.warning(err)
            ondc_status_tracker.record_error(err)
            return False

        url = f"{bap_uri.rstrip('/')}/on_search"
        body_bytes = json.dumps(payload, separators=(',', ':')).encode("utf-8")

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        # Sign request if signing is configured
        if self.config.is_signing_configured and self.config.private_key and self.config.subscriber_id and self.config.unique_key_id:
            try:
                sign_headers = sign_request(
                    private_key_b64=self.config.private_key,
                    subscriber_id=self.config.subscriber_id,
                    unique_key_id=self.config.unique_key_id,
                    method="POST",
                    path="/on_search",
                    body=body_bytes
                )
                headers.update(sign_headers)
            except ONDCSigningError as sig_err:
                logger.error("Failed to sign on_search callback: %s", sig_err)
                ondc_status_tracker.record_error(f"Signing failed: {sig_err}")
                return False

        try:
            async with httpx.AsyncClient(timeout=self.config.request_timeout_seconds) as client:
                resp = await client.post(url, content=body_bytes, headers=headers)
                if resp.status_code in (200, 201, 202):
                    ondc_status_tracker.record_callback_success()
                    logger.info("Successfully delivered on_search callback to %s", url)
                    return True
                else:
                    err = f"on_search callback to {url} returned HTTP {resp.status_code}: {resp.text[:200]}"
                    logger.warning(err)
                    ondc_status_tracker.record_error(err)
                    return False
        except Exception as net_err:
            err = f"Network failure dispatching on_search callback to {url}: {net_err}"
            logger.warning(err)
            ondc_status_tracker.record_error(err)
            return False


def get_ondc_client(config: Optional[ONDCConfig] = None) -> ONDCClient:
    from backend.app.integrations.ondc.config import ondc_config
    return ONDCClient(config or ondc_config)
