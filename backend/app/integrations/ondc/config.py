"""
ONDC Configuration Module.
Typed configuration for ONDC Retail seller-side integration (Beckn Protocol v1.2).
Provides safe environment defaults, parameter loading, and sanitized diagnostics.
"""

import os
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class ONDCConfig(BaseModel):
    environment: str = Field(default="development")
    subscriber_id: Optional[str] = Field(default=None)
    unique_key_id: Optional[str] = Field(default=None)
    public_key: Optional[str] = Field(default=None)
    private_key: Optional[str] = Field(default=None)
    gateway_url: Optional[str] = Field(default=None)
    bpp_uri: str = Field(default="http://localhost:8000/ondc")
    bpp_name: str = Field(default="Artisan AI Marketplace")
    bpp_description: str = Field(
        default="Direct digital commerce gateway for authentic Indian artisans and master craftspersons"
    )
    domain: str = Field(default="ONDC:RET12")
    country: str = Field(default="IND")
    city: str = Field(default="std:080")
    core_version: str = Field(default="1.2.0")
    ttl: str = Field(default="PT30S")
    request_timeout_seconds: float = Field(default=10.0)
    auth_timestamp_tolerance_seconds: int = Field(default=300)
    enforce_auth: bool = Field(default=False)

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def is_staging(self) -> bool:
        return self.environment.lower() in ("staging", "test", "preproduction")

    @property
    def is_subscriber_configured(self) -> bool:
        return bool(self.subscriber_id and self.subscriber_id.strip())

    @property
    def is_signing_configured(self) -> bool:
        return bool(
            self.private_key and self.private_key.strip() and
            self.public_key and self.public_key.strip() and
            self.unique_key_id and self.unique_key_id.strip()
        )

    @property
    def is_gateway_configured(self) -> bool:
        return bool(self.gateway_url and self.gateway_url.strip())

    def get_sanitized_summary(self) -> Dict[str, Any]:
        """Returns safe configuration metadata without exposing secret keys."""
        return {
            "environment": self.environment.upper(),
            "subscriber_id": self.subscriber_id if self.subscriber_id else None,
            "unique_key_id": self.unique_key_id if self.unique_key_id else None,
            "subscriber_configured": self.is_subscriber_configured,
            "signing_configured": self.is_signing_configured,
            "gateway_configured": self.is_gateway_configured,
            "domain": self.domain,
            "country": self.country,
            "city": self.city,
            "core_version": self.core_version,
            "enforce_auth": self.enforce_auth,
            "bpp_uri": self.bpp_uri,
        }


def load_ondc_config() -> ONDCConfig:
    """Loads ONDC configuration from environment variables with safe fallbacks."""
    env = os.getenv("ONDC_ENVIRONMENT", os.getenv("ENVIRONMENT", "development")).lower()
    subscriber_id = os.getenv("ONDC_SUBSCRIBER_ID", "").strip() or None
    unique_key_id = os.getenv("ONDC_UNIQUE_KEY_ID", "").strip() or None
    public_key = os.getenv("ONDC_PUBLIC_KEY", "").strip() or None
    private_key = os.getenv("ONDC_PRIVATE_KEY", "").strip() or None
    gateway_url = os.getenv("ONDC_GATEWAY_URL", "").strip() or None
    bpp_uri = os.getenv("ONDC_BPP_URI", "http://localhost:8000/ondc").strip()
    domain = os.getenv("ONDC_DOMAIN", "ONDC:RET12").strip()
    country = os.getenv("ONDC_COUNTRY", "IND").strip()
    city = os.getenv("ONDC_CITY", "std:080").strip()
    enforce_auth_raw = os.getenv("ONDC_ENFORCE_AUTH", "true" if env in ("staging", "production") else "false")
    enforce_auth = enforce_auth_raw.lower() in ("true", "1", "yes")

    return ONDCConfig(
        environment=env,
        subscriber_id=subscriber_id,
        unique_key_id=unique_key_id,
        public_key=public_key,
        private_key=private_key,
        gateway_url=gateway_url,
        bpp_uri=bpp_uri,
        domain=domain,
        country=country,
        city=city,
        enforce_auth=enforce_auth,
    )


# Global singleton instance
ondc_config = load_ondc_config()
