"""
Image Enhancement Service for Artisan AI Catalog Studio.

Provides production-grade studio lighting normalization, contrast/color elevation,
sharpness sharpening, and studio backdrop spotlight composition for craft products.
"""

import io
import base64
import logging
import math
from typing import Tuple, Optional
import httpx
from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger("artisan_ai")

STUDIO_BACKDROP_PALETTES = {
    "royal_silk": ((112, 26, 117), (46, 16, 101)),       # Royal Purple Silk
    "teak_wood": ((120, 53, 15), (69, 26, 3)),           # Teak Wood Warm Dark Brown
    "marble_pedestal": ((248, 250, 252), (203, 213, 225)),   # Marble Slate Light Grey
    "courtyard": ((154, 52, 18), (194, 65, 12))          # Heritage Terracotta Red
}

def create_radial_gradient_background(width: int, height: int, color1: Tuple[int, int, int], color2: Tuple[int, int, int]) -> Image.Image:
    """Creates a smooth radial studio backdrop canvas with center spotlight effect."""
    base = Image.new("RGB", (width, height), color2)
    spotlight = Image.new("RGB", (width, height), color1)
    mask = Image.new("L", (width, height), 0)
    
    cx, cy = width / 2.0, height / 2.0
    max_dist = math.sqrt(cx * cx + cy * cy)
    
    mask_pixels = bytearray(width * height)
    for y in range(height):
        for x in range(width):
            dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
            ratio = max(0.0, min(1.0, 1.0 - (dist / max_dist)))
            val = int((ratio ** 1.5) * 255)
            mask_pixels[y * width + x] = val
            
    mask.frombytes(bytes(mask_pixels))
    composite = Image.composite(spotlight, base, mask)
    return composite

def enhance_image_bytes(image_bytes: bytes, backdrop_id: str = "royal_silk") -> bytes:
    """
    Applies studio lighting normalization, contrast enhancement, sharpness sharpening,
    and studio backdrop spotlight composition to image bytes.
    Returns enhanced JPEG image bytes.
    """
    with Image.open(io.BytesIO(image_bytes)) as img:
        img = img.convert("RGB")
        
        # 1. Lighting, Contrast & Color Normalization
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.18)
        
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(1.06)
        
        enhancer = ImageEnhance.Color(img)
        img = enhancer.enhance(1.12)
        
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.30)
        
        # 2. Studio Lighting Frame Composition
        orig_w, orig_h = img.size
        target_w, target_h = max(600, orig_w), max(600, orig_h)
        
        colors = STUDIO_BACKDROP_PALETTES.get(backdrop_id, STUDIO_BACKDROP_PALETTES["royal_silk"])
        bg = create_radial_gradient_background(target_w, target_h, colors[0], colors[1])
        
        # Fit craft image into studio frame with margin
        margin = int(min(target_w, target_h) * 0.08)
        max_craft_w = target_w - (2 * margin)
        max_craft_h = target_h - (2 * margin)
        
        scale = min(max_craft_w / float(orig_w), max_craft_h / float(orig_h))
        new_w = int(orig_w * scale)
        new_h = int(orig_h * scale)
        
        resized_craft = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        offset_x = (target_w - new_w) // 2
        offset_y = (target_h - new_h) // 2
        
        bg.paste(resized_craft, (offset_x, offset_y))
        
        output_buffer = io.BytesIO()
        bg.save(output_buffer, format="JPEG", quality=90)
        return output_buffer.getvalue()

async def enhance_studio_image(
    image_url_or_data: Optional[str],
    backdrop_id: str = "royal_silk"
) -> Tuple[str, bool, str]:
    """
    Asynchronously enhances a product photo for the studio.
    Returns: (enhanced_url_or_data_uri, is_enhanced, notice_message)
    """
    if not image_url_or_data or not image_url_or_data.strip():
        return "", False, "Photo enhancement unavailable. No input photo provided."
    
    raw = image_url_or_data.strip()
    
    try:
        image_bytes = None
        if raw.startswith("data:image/"):
            header, encoded = raw.split(",", 1)
            image_bytes = base64.b64decode(encoded)
        elif raw.startswith("http://") or raw.startswith("https://"):
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(raw)
                if resp.status_code == 200:
                    image_bytes = resp.content
        
        if not image_bytes:
            return raw, False, "Photo enhancement unavailable. Could not retrieve input photo."
            
        enhanced_bytes = enhance_image_bytes(image_bytes, backdrop_id=backdrop_id)
        encoded_str = base64.b64encode(enhanced_bytes).decode("utf-8")
        data_uri = f"data:image/jpeg;base64,{encoded_str}"
        
        return data_uri, True, "AI Studio lighting normalization and studio backdrop composition applied."
        
    except Exception as e:
        logger.warning("[ImageEnhancer] Studio enhancement fallback triggered: %s", str(e))
        return raw, False, "Photo enhancement unavailable. Original photo saved."
