import ipaddress
import logging
import socket
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse, urljoin
import httpx

logger = logging.getLogger("artisan_ai")

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (ArtisanAI-MarketBot/1.0)"
)
DEFAULT_TIMEOUT_SECONDS = 5.0
MAX_RESPONSE_BYTES = 1_572_864  # 1.5 MB maximum to avoid memory bloat / DOS
MAX_REDIRECTS = 3

DISALLOWED_DOMAINS_SUFFIXES = (
    ".local", ".internal", ".lan", ".corp", ".home", ".test", ".example", ".invalid", "localhost"
)

@dataclass
class FetchedPage:
    url: str
    html: str
    status_code: int
    success: bool
    error: Optional[str] = None
    final_url: Optional[str] = None

class SSRFSecurityError(ValueError):
    """Raised when a candidate URL targets a private or forbidden network destination."""
    pass

def is_ip_allowed(ip_str: str) -> bool:
    """
    Checks if an IP address string is globally routable and not internal/private/loopback.
    """
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_loopback:
            return False
        if ip.is_private:
            return False
        if ip.is_link_local:
            return False
        if ip.is_multicast:
            return False
        if ip.is_reserved:
            return False
        if ip.is_unspecified:
            return False
        # Disallow carrier-grade NAT (100.64.0.0/10)
        if isinstance(ip, ipaddress.IPv4Address) and ip in ipaddress.ip_network("100.64.0.0/10"):
            return False
        return True
    except ValueError:
        return False

def validate_url_security(target_url: str) -> None:
    """
    Validates scheme and host of target_url against SSRF and private network access.
    Raises SSRFSecurityError if URL is unsafe.
    """
    if not target_url or not isinstance(target_url, str):
        raise SSRFSecurityError("URL cannot be empty")

    parsed = urlparse(target_url.strip())
    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        raise SSRFSecurityError(f"Unsupported scheme '{scheme}'. Only http and https are permitted.")

    hostname = (parsed.hostname or "").lower().strip()
    if not hostname:
        raise SSRFSecurityError("Missing hostname in URL")

    # Reject localhost, 0.0.0.0, or specific internal domain suffixes
    if hostname == "localhost" or any(hostname.endswith(suffix) for suffix in DISALLOWED_DOMAINS_SUFFIXES):
        raise SSRFSecurityError(f"Disallowed internal hostname: {hostname}")

    # Resolve IP addresses and verify none are private / loopback
    try:
        addr_infos = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as dns_err:
        raise SSRFSecurityError(f"DNS resolution failure for host '{hostname}': {dns_err}")
    except Exception as ex:
        raise SSRFSecurityError(f"DNS lookup error: {ex}")

    if not addr_infos:
        raise SSRFSecurityError(f"No IP addresses found for hostname '{hostname}'")

    for addr in addr_infos:
        sockaddr = addr[4]
        ip_cand = sockaddr[0]
        if not is_ip_allowed(ip_cand):
            raise SSRFSecurityError(f"Host '{hostname}' resolved to disallowed/private IP: {ip_cand}")

class MarketPageFetcher:
    """
    Safe, SSRF-guarded HTTP client dedicated to fetching public product pages for market research.
    Follows redirects safely, enforces strict timeout, and restricts max response size.
    """

    def __init__(
        self,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        max_bytes: int = MAX_RESPONSE_BYTES,
        user_agent: str = DEFAULT_USER_AGENT
    ):
        self.timeout = timeout
        self.max_bytes = max_bytes
        self.user_agent = user_agent

    async def fetch_page(self, url: str) -> FetchedPage:
        """
        Fetches an external product page safely.
        Never crashes; returns FetchedPage with success=False on any error.
        """
        current_url = (url or "").strip()

        try:
            validate_url_security(current_url)
        except SSRFSecurityError as ssrf_err:
            logger.warning("[MarketPageFetcher] SSRF check rejected URL '%s': %s", current_url, ssrf_err)
            return FetchedPage(
                url=current_url,
                html="",
                status_code=403,
                success=False,
                error=f"SSRF rejection: {ssrf_err}"
            )

        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-IN,en;q=0.9",
        }

        redirect_count = 0
        while redirect_count <= MAX_REDIRECTS:
            try:
                # Disable httpx automatic redirect following to validate each redirect hop against SSRF
                async with httpx.AsyncClient(
                    timeout=self.timeout,
                    follow_redirects=False,
                    verify=True
                ) as client:
                    async with client.stream("GET", current_url, headers=headers) as resp:
                        # Handle redirects manually
                        if resp.status_code in (301, 302, 303, 307, 308):
                            loc = resp.headers.get("Location")
                            if not loc:
                                return FetchedPage(
                                    url=url,
                                    html="",
                                    status_code=resp.status_code,
                                    success=False,
                                    error="Redirect missing Location header",
                                    final_url=current_url
                                )
                            next_url = urljoin(current_url, loc.strip())
                            try:
                                validate_url_security(next_url)
                            except SSRFSecurityError as ssrf_err:
                                logger.warning(
                                    "[MarketPageFetcher] SSRF check blocked redirect from '%s' to '%s': %s",
                                    current_url, next_url, ssrf_err
                                )
                                return FetchedPage(
                                    url=url,
                                    html="",
                                    status_code=403,
                                    success=False,
                                    error=f"Redirect blocked: {ssrf_err}",
                                    final_url=next_url
                                )
                            current_url = next_url
                            redirect_count += 1
                            continue

                        if resp.status_code != 200:
                            return FetchedPage(
                                url=url,
                                html="",
                                status_code=resp.status_code,
                                success=False,
                                error=f"HTTP {resp.status_code}",
                                final_url=current_url
                            )

                        content_type = resp.headers.get("Content-Type", "").lower()
                        if "html" not in content_type and "xml" not in content_type and "json" not in content_type:
                            return FetchedPage(
                                url=url,
                                html="",
                                status_code=resp.status_code,
                                success=False,
                                error=f"Non-HTML content type: {content_type}",
                                final_url=current_url
                            )

                        # Stream content with size limit
                        body_parts = []
                        total_bytes = 0
                        async for chunk in resp.aiter_bytes(chunk_size=8192):
                            total_bytes += len(chunk)
                            if total_bytes > self.max_bytes:
                                logger.info("[MarketPageFetcher] Page %s exceeded max size limit of %d bytes", current_url, self.max_bytes)
                                break
                            body_parts.append(chunk)

                        raw_bytes = b"".join(body_parts)
                        # Decode HTML defensively
                        encoding = resp.encoding or "utf-8"
                        try:
                            html_text = raw_bytes.decode(encoding, errors="replace")
                        except Exception:
                            html_text = raw_bytes.decode("utf-8", errors="replace")

                        return FetchedPage(
                            url=url,
                            html=html_text,
                            status_code=200,
                            success=True,
                            final_url=current_url
                        )

            except httpx.TimeoutException:
                return FetchedPage(
                    url=url,
                    html="",
                    status_code=408,
                    success=False,
                    error="Request timed out",
                    final_url=current_url
                )
            except httpx.RequestError as req_err:
                return FetchedPage(
                    url=url,
                    html="",
                    status_code=502,
                    success=False,
                    error=f"Connection error: {str(req_err)}",
                    final_url=current_url
                )
            except Exception as ex:
                return FetchedPage(
                    url=url,
                    html="",
                    status_code=500,
                    success=False,
                    error=f"Unexpected fetch error: {str(ex)}",
                    final_url=current_url
                )

        return FetchedPage(
            url=url,
            html="",
            status_code=310,
            success=False,
            error="Too many redirects",
            final_url=current_url
        )
