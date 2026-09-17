"""
ONDC / Beckn Protocol Cryptographic Signing and Verification Foundation.
Implements RFC 8032 Ed25519 signatures and BLAKE2b-512 request hashing per
ONDC participant signing specifications.
"""

import re
import time
import base64
import hashlib
import logging
from typing import Tuple, Dict, Optional, Any
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.exceptions import InvalidSignature

logger = logging.getLogger("artisan_ai.ondc.signing")

class ONDCSigningError(Exception):
    """Base exception for ONDC signing and verification errors."""
    pass

class ONDCSignatureVerificationError(ONDCSigningError):
    """Raised when an incoming ONDC signature fails verification."""
    pass

class ONDCTimestampExpiredError(ONDCSigningError):
    """Raised when an incoming request timestamp is expired or outside tolerance window."""
    pass


def generate_keypair() -> Tuple[str, str]:
    """
    Generates a new Ed25519 keypair for ONDC staging or local development.
    Returns (public_key_base64, private_key_base64).
    """
    private_key = ed25519.Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    priv_bytes = private_key.private_bytes_raw()
    pub_bytes = public_key.public_bytes_raw()

    priv_b64 = base64.b64encode(priv_bytes).decode("utf-8")
    pub_b64 = base64.b64encode(pub_bytes).decode("utf-8")
    return pub_b64, priv_b64


def create_blake512_digest(body: bytes) -> str:
    """
    Computes BLAKE-512 (BLAKE2b 512-bit / 64-byte) digest of request body.
    Returns format: 'BLAKE-512=<base64_hash>'
    """
    digest_raw = hashlib.blake2b(body, digest_size=64).digest()
    digest_b64 = base64.b64encode(digest_raw).decode("utf-8")
    return f"BLAKE-512={digest_b64}"


def create_signing_string(request_target: str, created: int, expires: int, digest: str) -> str:
    """
    Creates the canonical signing string defined by Beckn/ONDC HTTP signatures.
    Format:
    (request-target): post /on_search
    created: 162...
    expires: 162...
    digest: BLAKE-512=...
    """
    return (
        f"(request-target): {request_target}\n"
        f"created: {created}\n"
        f"expires: {expires}\n"
        f"digest: {digest}"
    )


def sign_request(
    private_key_b64: str,
    subscriber_id: str,
    unique_key_id: str,
    method: str,
    path: str,
    body: bytes,
    created: Optional[int] = None,
    ttl_seconds: int = 300
) -> Dict[str, str]:
    """
    Signs an outgoing ONDC request using Ed25519.
    Returns dict containing 'Authorization' and 'Digest' headers.
    """
    try:
        priv_bytes = base64.b64decode(private_key_b64)
        if len(priv_bytes) != 32:
            raise ValueError(f"Invalid Ed25519 private key length: {len(priv_bytes)} bytes (expected 32)")
        private_key = ed25519.Ed25519PrivateKey.from_private_bytes(priv_bytes)
    except Exception as exc:
        raise ONDCSigningError(f"Failed to load Ed25519 private key: {exc}") from exc

    now = int(time.time()) if created is None else created
    expires = now + ttl_seconds
    digest_header = create_blake512_digest(body)
    request_target = f"{method.lower()} {path}"

    signing_str = create_signing_string(
        request_target=request_target,
        created=now,
        expires=expires,
        digest=digest_header
    )

    signature_raw = private_key.sign(signing_str.encode("utf-8"))
    signature_b64 = base64.b64encode(signature_raw).decode("utf-8")

    key_id = f"{subscriber_id}|{unique_key_id}|ed25519"
    auth_header = (
        f'Signature keyId="{key_id}",'
        f'algorithm="ed25519",'
        f'created="{now}",'
        f'expires="{expires}",'
        f'headers="(request-target) created expires digest",'
        f'signature="{signature_b64}"'
    )

    return {
        "Authorization": auth_header,
        "Digest": digest_header
    }


def parse_authorization_header(auth_header: str) -> Dict[str, str]:
    """
    Parses key-value parameters from the Beckn Signature Authorization header.
    Example: Signature keyId="...",algorithm="ed25519",created="...",...
    """
    if not auth_header or not auth_header.strip():
        raise ONDCSignatureVerificationError("Missing Authorization header")

    clean_header = auth_header.strip()
    if clean_header.startswith("Signature "):
        clean_header = clean_header[len("Signature "):]

    # Pattern to match key="value" or key=value pairs
    pattern = re.compile(r'(\w+)=(?:"([^"]*)"|([^,]*))')
    matches = pattern.findall(clean_header)
    params = {}
    for key, val_quoted, val_unquoted in matches:
        params[key] = val_quoted if val_quoted != "" else val_unquoted

    required = ["keyId", "algorithm", "created", "expires", "signature"]
    for req in required:
        if req not in params:
            raise ONDCSignatureVerificationError(f"Authorization header missing required parameter '{req}'")

    return params


def verify_signature(
    auth_header: str,
    method: str,
    path: str,
    body: bytes,
    public_key_b64: Optional[str] = None,
    lookup_public_key_fn: Optional[Any] = None,
    tolerance_seconds: int = 300
) -> bool:
    """
    Verifies an incoming ONDC HTTP request signature.
    Validates:
    1. Authorization header format and Ed25519 algorithm
    2. Request timestamp expiration and creation tolerance window
    3. BLAKE-512 body digest matching
    4. Cryptographic Ed25519 signature against provided or looked-up public key
    """
    params = parse_authorization_header(auth_header)

    if params["algorithm"].lower() != "ed25519":
        raise ONDCSignatureVerificationError(f"Unsupported signature algorithm: {params['algorithm']}")

    try:
        created = int(params["created"])
        expires = int(params["expires"])
    except ValueError as val_err:
        raise ONDCSignatureVerificationError(f"Invalid timestamp integer in signature header: {val_err}")

    now = int(time.time())

    # Expiry verification
    if now > expires + tolerance_seconds:
        raise ONDCTimestampExpiredError(f"Request signature expired (expires={expires}, now={now})")

    if abs(now - created) > tolerance_seconds * 2:
        raise ONDCTimestampExpiredError(f"Request timestamp created={created} exceeds tolerance window (now={now})")

    # Resolve public key
    pub_key_str = public_key_b64
    key_id = params["keyId"]
    key_parts = key_id.split("|")
    subscriber_id = key_parts[0] if len(key_parts) > 0 else ""
    unique_key_id = key_parts[1] if len(key_parts) > 1 else ""

    if not pub_key_str and lookup_public_key_fn:
        pub_key_str = lookup_public_key_fn(subscriber_id, unique_key_id)

    if not pub_key_str:
        raise ONDCSignatureVerificationError(
            f"No public key available to verify signature for subscriber '{subscriber_id}' (keyId '{unique_key_id}')"
        )

    try:
        pub_bytes = base64.b64decode(pub_key_str)
        if len(pub_bytes) != 32:
            raise ValueError(f"Invalid Ed25519 public key length: {len(pub_bytes)} bytes (expected 32)")
        public_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
    except Exception as key_err:
        raise ONDCSignatureVerificationError(f"Invalid public key bytes: {key_err}") from key_err

    # Recompute digest
    computed_digest = create_blake512_digest(body)
    request_target = f"{method.lower()} {path}"

    signing_str = create_signing_string(
        request_target=request_target,
        created=created,
        expires=expires,
        digest=computed_digest
    )

    try:
        sig_bytes = base64.b64decode(params["signature"])
        public_key.verify(sig_bytes, signing_str.encode("utf-8"))
        return True
    except InvalidSignature as inv_sig:
        raise ONDCSignatureVerificationError("Cryptographic signature verification failed") from inv_sig
    except Exception as exc:
        raise ONDCSignatureVerificationError(f"Signature decoding or verification error: {exc}") from exc
