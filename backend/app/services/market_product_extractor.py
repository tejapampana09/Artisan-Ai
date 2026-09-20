import re
import json
import logging
from html import unescape
from typing import Optional, List, Dict, Any

logger = logging.getLogger("artisan_ai")

AMBIGUOUS_PRICE_PATTERNS = [
    r"\bper\s+month\b",
    r"\b/mo\b",
    r"\bper\s+year\b",
    r"\b/yr\b",
    r"\bstarting\s+at\b",
    r"\bstarts\s+at\b",
    r"\bup\s+to\b",
    r"\bsave\s+up\s+to\b",
    r"\bfrom\s+₹",
    r"\bfrom\s+rs",
    r"\bfrom\s+inr",
]

class ExtractedProductData:
    def __init__(
        self,
        title: str,
        price: Optional[float] = None,
        currency: str = "INR",
        description: str = "",
        image_url: Optional[str] = None,
        category: Optional[str] = None,
        materials: Optional[List[str]] = None,
        availability: Optional[str] = None,
        extraction_method: str = "HTML_FALLBACK"
    ):
        self.title = (title or "").strip()
        self.price = price
        self.currency = currency or "INR"
        self.description = (description or "").strip()
        self.image_url = image_url
        self.category = category
        self.materials = materials or []
        self.availability = availability
        self.extraction_method = extraction_method

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "price": self.price,
            "currency": self.currency,
            "description": self.description,
            "image_url": self.image_url,
            "category": self.category,
            "materials": self.materials,
            "availability": self.availability,
            "extraction_method": self.extraction_method
        }

def clean_extracted_price(raw_val: Any, context_str: str = "") -> Optional[float]:
    """
    Validates and cleans a price value.
    Never invents or infers price; returns None if price is ambiguous, non-positive, or subscription-based.
    """
    if raw_val is None:
        return None

    # Check for ambiguous subscription or range patterns in context
    if context_str:
        c_lower = context_str.lower()
        for pat in AMBIGUOUS_PRICE_PATTERNS:
            if re.search(pat, c_lower):
                return None

    str_val = str(raw_val).strip()
    if not str_val:
        return None

    # Check for price range e.g. "999-2999" or "999 - 2999"
    if re.search(r"\d+\s*[-–—]\s*\d+", str_val):
        return None

    # Strip currency symbols and whitespace
    clean = re.sub(r"[^\d.]", "", str_val)
    if not clean:
        return None

    # Handle multiple decimals defensively (e.g. 1.200.00)
    parts = clean.split(".")
    if len(parts) > 2:
        clean = "".join(parts[:-1]) + "." + parts[-1]

    try:
        val = float(clean)
        if val <= 0:
            return None
        # Defend against unreasonable values (e.g. barcode numbers parsed as price)
        if val > 10_000_000:
            return None
        return round(val, 2)
    except (ValueError, TypeError):
        return None

class MarketProductExtractor:
    """
    Deterministic product page extractor prioritizing:
    1. Schema.org JSON-LD (Product, Offer, AggregateOffer)
    2. OpenGraph / Product meta tags
    3. Safe HTML fallback
    """

    @classmethod
    def extract_from_html(cls, html: str, page_url: str = "") -> Optional[ExtractedProductData]:
        if not html or not isinstance(html, str):
            return None

        # Priority 1: Schema.org JSON-LD
        json_ld_result = cls._extract_json_ld(html)
        if json_ld_result and json_ld_result.title:
            return json_ld_result

        # Priority 2: OpenGraph metadata
        og_result = cls._extract_opengraph(html)
        if og_result and og_result.title:
            return og_result

        # Priority 3: HTML fallback
        fallback_result = cls._extract_html_fallback(html)
        if fallback_result and fallback_result.title:
            return fallback_result

        return None

    @classmethod
    def _extract_json_ld(cls, html: str) -> Optional[ExtractedProductData]:
        pattern = re.compile(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.DOTALL | re.IGNORECASE)
        matches = pattern.findall(html)

        for raw_json in matches:
            content = raw_json.strip()
            if not content:
                continue
            try:
                data = json.loads(content)
            except Exception:
                # Try unescaping HTML entities in JSON
                try:
                    data = json.loads(unescape(content))
                except Exception:
                    continue

            # Traverse data to find Schema.org Product
            product_nodes = cls._find_product_nodes(data)
            for p_node in product_nodes:
                name = str(p_node.get("name") or p_node.get("title") or "").strip()
                if not name:
                    continue

                desc = str(p_node.get("description") or "").strip()
                category = str(p_node.get("category") or "").strip() or None

                # Extract image
                image_url = None
                raw_img = p_node.get("image")
                if isinstance(raw_img, str) and raw_img.strip():
                    image_url = raw_img.strip()
                elif isinstance(raw_img, list) and raw_img:
                    first = raw_img[0]
                    if isinstance(first, str):
                        image_url = first.strip()
                    elif isinstance(first, dict) and first.get("url"):
                        image_url = str(first["url"]).strip()
                elif isinstance(raw_img, dict) and raw_img.get("url"):
                    image_url = str(raw_img["url"]).strip()

                # Extract materials
                materials = []
                raw_mat = p_node.get("material")
                if isinstance(raw_mat, list):
                    materials = [str(m).strip() for m in raw_mat if str(m).strip()]
                elif isinstance(raw_mat, str) and raw_mat.strip():
                    materials = [m.strip() for m in raw_mat.split(",") if m.strip()]

                # Extract offers & price
                price = None
                currency = "INR"
                availability = None

                offers = p_node.get("offers")
                if isinstance(offers, dict):
                    price, currency, availability = cls._parse_offer_node(offers, desc)
                elif isinstance(offers, list) and offers:
                    for off in offers:
                        if isinstance(off, dict):
                            p, c, a = cls._parse_offer_node(off, desc)
                            if p is not None:
                                price = p
                                currency = c
                                availability = a
                                break

                # Fallback: if price wasn't in offers, check if price is directly on node
                if price is None and p_node.get("price"):
                    price = clean_extracted_price(p_node.get("price"), desc)
                    if p_node.get("priceCurrency"):
                        currency = str(p_node.get("priceCurrency")).strip().upper()

                return ExtractedProductData(
                    title=name,
                    price=price,
                    currency=currency,
                    description=desc,
                    image_url=image_url,
                    category=category,
                    materials=materials,
                    availability=availability,
                    extraction_method="JSON_LD"
                )

        return None

    @classmethod
    def _find_product_nodes(cls, data: Any) -> List[Dict[str, Any]]:
        nodes = []
        if isinstance(data, dict):
            t = data.get("@type")
            if t == "Product" or (isinstance(t, list) and "Product" in t):
                nodes.append(data)
            elif "@graph" in data and isinstance(data["@graph"], list):
                nodes.extend(cls._find_product_nodes(data["@graph"]))
            else:
                for k, v in data.items():
                    if isinstance(v, (dict, list)):
                        nodes.extend(cls._find_product_nodes(v))
        elif isinstance(data, list):
            for item in data:
                nodes.extend(cls._find_product_nodes(item))
        return nodes

    @classmethod
    def _parse_offer_node(cls, offer: Dict[str, Any], context: str = "") -> tuple[Optional[float], str, Optional[str]]:
        currency = str(offer.get("priceCurrency") or "INR").strip().upper()
        availability = offer.get("availability")
        if availability and isinstance(availability, str):
            availability = availability.split("/")[-1]

        # Check price or lowPrice (AggregateOffer)
        raw_price = offer.get("price") or offer.get("lowPrice")
        price = clean_extracted_price(raw_price, context)
        return price, currency, availability

    @classmethod
    def _extract_opengraph(cls, html: str) -> Optional[ExtractedProductData]:
        meta_tags = re.findall(r'<meta\b[^>]*>', html, re.IGNORECASE)
        meta_dict = {}

        for tag in meta_tags:
            prop_match = re.search(r'(?:property|name)=["\']([^"\']+)["\']', tag, re.IGNORECASE)
            content_match = re.search(r'content=["\']([^"\']*)["\']', tag, re.IGNORECASE)
            if prop_match and content_match:
                key = prop_match.group(1).lower().strip()
                val = unescape(content_match.group(1).strip())
                meta_dict[key] = val

        title = meta_dict.get("og:title") or meta_dict.get("twitter:title")
        if not title:
            return None

        # Clean pipe / separator artifacts from titles (e.g. "Item Title | Store Name")
        clean_title = re.split(r'\s+[|\-–—:]\s+', title)[0].strip()
        if len(clean_title) < 3:
            clean_title = title.strip()

        desc = meta_dict.get("og:description") or meta_dict.get("description") or meta_dict.get("twitter:description") or ""
        img = meta_dict.get("og:image") or meta_dict.get("twitter:image")

        # Check for OpenGraph product price
        raw_price = (
            meta_dict.get("product:price:amount") or
            meta_dict.get("og:price:amount") or
            meta_dict.get("price")
        )
        raw_currency = (
            meta_dict.get("product:price:currency") or
            meta_dict.get("og:price:currency") or
            "INR"
        ).strip().upper()

        price = clean_extracted_price(raw_price, desc)

        return ExtractedProductData(
            title=clean_title,
            price=price,
            currency=raw_currency,
            description=desc,
            image_url=img,
            category=None,
            materials=[],
            availability=None,
            extraction_method="OPEN_GRAPH"
        )

    @classmethod
    def _extract_html_fallback(cls, html: str) -> Optional[ExtractedProductData]:
        # Extract title from <title> tag or <h1>
        title = ""
        title_m = re.search(r'<title\b[^>]*>(.*?)</title>', html, re.DOTALL | re.IGNORECASE)
        if title_m:
            raw_title = unescape(title_m.group(1).strip())
            # Clean common portal suffixes e.g. "Buy Saree Online | Amazon.in"
            clean_title = re.split(r'\s+[|\-–—]\s+', raw_title)[0].strip()
            title = clean_title if len(clean_title) >= 3 else raw_title

        if not title:
            h1_m = re.search(r'<h1\b[^>]*>(.*?)</h1>', html, re.DOTALL | re.IGNORECASE)
            if h1_m:
                h1_text = re.sub(r'<[^>]+>', '', h1_m.group(1)).strip()
                title = unescape(h1_text)

        if not title:
            return None

        # Extract meta description
        desc = ""
        desc_m = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', html, re.IGNORECASE)
        if desc_m:
            desc = unescape(desc_m.group(1).strip())

        # Safe visible price search in HTML text
        price = None
        # Look for explicit INR currency patterns
        price_patterns = [
            r'(?:₹|Rs\.?|INR)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)',
        ]
        for pat in price_patterns:
            matches = list(re.finditer(pat, html, re.IGNORECASE))
            if matches:
                for match in matches:
                    cand_str = match.group(1)
                    # Extract surrounding context (40 chars before and after) to verify no ambiguity
                    start = max(0, match.start() - 40)
                    end = min(len(html), match.end() + 40)
                    context = html[start:end]
                    p_val = clean_extracted_price(cand_str, context)
                    if p_val is not None:
                        price = p_val
                        break
                if price is not None:
                    break

        return ExtractedProductData(
            title=title,
            price=price,
            currency="INR",
            description=desc,
            image_url=None,
            category=None,
            materials=[],
            availability=None,
            extraction_method="HTML_FALLBACK"
        )
