"""
Tests for ONDC Cryptographic Signing, Verification, and Replay Protection.
Verifies:
- Ed25519 RFC 8032 keypair generation
- BLAKE-512 (BLAKE2b 512-bit) body digest generation
- Canonical HTTP signature generation per Beckn protocol specification
- Signature verification against valid public keys
- Rejection of tampered payloads, expired timestamps, and wrong keys
- Message idempotency and duplicate replay prevention
"""

import time
import pytest

from backend.app.integrations.ondc.signing import (
    generate_keypair,
    create_blake512_digest,
    create_signing_string,
    sign_request,
    verify_signature,
    parse_authorization_header,
    ONDCSigningError,
    ONDCSignatureVerificationError,
    ONDCTimestampExpiredError,
)
from backend.app.integrations.ondc.idempotency import ONDCIdempotencyTracker


def test_ed25519_keypair_generation():
    """Generates valid 32-byte Ed25519 public and private keys."""
    pub_b64, priv_b64 = generate_keypair()
    assert isinstance(pub_b64, str) and len(pub_b64) == 44 # 32 bytes base64 encoded
    assert isinstance(priv_b64, str) and len(priv_b64) == 44


def test_blake512_digest_format():
    """Digest format must strictly follow 'BLAKE-512=<base64_digest>'."""
    body = b'{"message": {"intent": {"query": "saree"}}}'
    digest = create_blake512_digest(body)
    assert digest.startswith("BLAKE-512=")
    digest_val = digest[len("BLAKE-512="):]
    # 64 bytes base64 encoded is 88 characters (86 + 2 padding '=' or 88)
    assert len(digest_val) == 88


def test_sign_and_verify_valid_request():
    """Sign an outgoing request and verify it succeeds with the corresponding public key."""
    pub_b64, priv_b64 = generate_keypair()
    subscriber_id = "artisan-ai-bpp.staging"
    unique_key_id = "key-2026"
    method = "POST"
    path = "/on_search"
    body = b'{"context": {"action": "on_search"}, "message": {"catalog": {}}}'

    headers = sign_request(
        private_key_b64=priv_b64,
        subscriber_id=subscriber_id,
        unique_key_id=unique_key_id,
        method=method,
        path=path,
        body=body,
        ttl_seconds=300
    )

    assert "Authorization" in headers
    assert "Digest" in headers
    auth_header = headers["Authorization"]
    assert f'keyId="{subscriber_id}|{unique_key_id}|ed25519"' in auth_header
    assert 'algorithm="ed25519"' in auth_header

    # Verify signature
    is_valid = verify_signature(
        auth_header=auth_header,
        method=method,
        path=path,
        body=body,
        public_key_b64=pub_b64,
        tolerance_seconds=300
    )
    assert is_valid is True


def test_verify_rejects_tampered_payload():
    """Tampering with even a single byte of body must cause verification failure."""
    pub_b64, priv_b64 = generate_keypair()
    method = "POST"
    path = "/on_search"
    body = b'{"amount": 1000}'

    headers = sign_request(
        private_key_b64=priv_b64,
        subscriber_id="sub1",
        unique_key_id="k1",
        method=method,
        path=path,
        body=body
    )

    tampered_body = b'{"amount": 1001}'
    with pytest.raises(ONDCSignatureVerificationError):
        verify_signature(
            auth_header=headers["Authorization"],
            method=method,
            path=path,
            body=tampered_body,
            public_key_b64=pub_b64
        )


def test_verify_rejects_expired_timestamp():
    """Request with an expired timestamp must be rejected with ONDCTimestampExpiredError."""
    pub_b64, priv_b64 = generate_keypair()
    method = "POST"
    path = "/search"
    body = b'{"action": "search"}'

    past_time = int(time.time()) - 1000
    headers = sign_request(
        private_key_b64=priv_b64,
        subscriber_id="sub1",
        unique_key_id="k1",
        method=method,
        path=path,
        body=body,
        created=past_time,
        ttl_seconds=60
    )

    with pytest.raises(ONDCTimestampExpiredError):
        verify_signature(
            auth_header=headers["Authorization"],
            method=method,
            path=path,
            body=body,
            public_key_b64=pub_b64,
            tolerance_seconds=60
        )


def test_verify_rejects_mismatched_public_key():
    """Verification must fail if signed with a different keypair."""
    pub_b64_a, priv_b64_a = generate_keypair()
    pub_b64_b, _ = generate_keypair()

    headers = sign_request(
        private_key_b64=priv_b64_a,
        subscriber_id="sub1",
        unique_key_id="k1",
        method="POST",
        path="/search",
        body=b'{"test": 1}'
    )

    with pytest.raises(ONDCSignatureVerificationError):
        verify_signature(
            auth_header=headers["Authorization"],
            method="POST",
            path="/search",
            body=b'{"test": 1}',
            public_key_b64=pub_b64_b
        )


def test_parse_authorization_header_errors():
    """Malformed headers must raise ONDCSignatureVerificationError."""
    with pytest.raises(ONDCSignatureVerificationError):
        parse_authorization_header("")

    with pytest.raises(ONDCSignatureVerificationError):
        parse_authorization_header('Signature keyId="foo"')


def test_idempotency_tracker():
    """Idempotency tracker detects duplicates and respects TTL."""
    tracker = ONDCIdempotencyTracker(ttl_seconds=2)
    tracker.clear()

    assert tracker.is_duplicate("msg_100", "tx_1") is False
    tracker.record("msg_100", "tx_1")
    assert tracker.is_duplicate("msg_100", "tx_1") is True

    # Different message ID is not duplicate
    assert tracker.is_duplicate("msg_101", "tx_1") is False

    # After TTL, expires
    time.sleep(2.1)
    assert tracker.is_duplicate("msg_100", "tx_1") is False
