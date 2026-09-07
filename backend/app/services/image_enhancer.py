"""
Image Enhancement & Automatic Background Removal Service for Artisan AI Catalog Studio.

Provides:
1. Product Subject Segmentation & Automatic Background Removal (rembg U2Net + threshold corner-sampling fallback).
2. Lighting & Color Normalization (contrast, brightness, saturation, sharpness).
3. Studio Backdrop Composition with Drop Shadow & Spotlight Pedestal.
"""

import io
import base64
import logging
import math
from typing import Tuple, Optional
import httpx
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger("artisan_ai")

STUDIO_BACKDROP_PALETTES = {
    "royal_silk": ((112, 26, 117), (46, 16, 101)),       # Royal Purple Silk Spotlight
    "teak_wood": ((120, 53, 15), (69, 26, 3)),           # Teak Wood Warm Dark Brown
    "marble_pedestal": ((248, 250, 252), (203, 213, 225)),   # Marble Slate Light Grey
    "courtyard": ((154, 52, 18), (194, 65, 12))          # Heritage Terracotta Red
}

def remove_cluttered_background_fallback(img_rgba: Image.Image) -> Image.Image:
    """
    Fallback background removal using corner sampling and color distance thresholding.
    Masks out background clutter colors near image boundaries (table surface, floor, plain wall).
    """
    arr = np.array(img_rgba)
    h, w, c = arr.shape
    rgb = arr[:, :, :3].astype(np.float32)
    
    # Sample corner pixels (5x5 boxes in 4 corners) representing cluttered table/floor
    corners = np.concatenate([
        rgb[0:5, 0:5].reshape(-1, 3),
        rgb[0:5, w-5:w].reshape(-1, 3),
        rgb[h-5:h, 0:5].reshape(-1, 3),
        rgb[h-5:h, w-5:w].reshape(-1, 3)
    ], axis=0)
    bg_color = np.median(corners, axis=0)
    
    # Euclidean distance from background color
    dist = np.sqrt(np.sum((rgb - bg_color) ** 2, axis=2))
    
    # Threshold for transparency (tapered alpha transition)
    alpha = np.clip((dist - 25.0) / 35.0, 0.0, 1.0) * 255.0
    
    # Radial mask boost to ensure central product subject is preserved crisp
    y_idx, x_idx = np.ogrid[:h, :w]
    cy, cx = h / 2.0, w / 2.0
    radial_center_boost = np.clip(1.0 - np.sqrt((x_idx - cx)**2 + (y_idx - cy)**2) / (min(h, w) * 0.45), 0.0, 1.0)
    alpha = np.maximum(alpha, radial_center_boost * 255.0)
    
    arr[:, :, 3] = alpha.astype(np.uint8)
    return Image.fromarray(arr, mode="RGBA")

def remove_cluttered_background(img: Image.Image) -> Image.Image:
    """
    Segments the craft product subject and removes background clutter (tables, floor, room background).
    Tries AI rembg segmentation first, falling back to threshold segmentation if unavailable.
    """
    img_rgba = img.convert("RGBA")
    
    try:
        import onnxruntime
        import rembg
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        input_bytes = buf.getvalue()
        
        output_bytes = rembg.remove(input_bytes)
        output_img = Image.open(io.BytesIO(output_bytes)).convert("RGBA")
        if output_img.width > 0 and output_img.height > 0:
            return output_img
    except BaseException as e:
        logger.info("[ImageEnhancer] rembg AI segmentation fallback triggered: %s", str(e))
        
    return remove_cluttered_background_fallback(img_rgba)

def create_radial_gradient_background(width: int, height: int, color1: Tuple[int, int, int], color2: Tuple[int, int, int]) -> Image.Image:
    """Creates a smooth radial studio backdrop canvas with center spotlight effect."""
    base = Image.new("RGBA", (width, height), (*color2, 255))
    spotlight = Image.new("RGBA", (width, height), (*color1, 255))
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
    1. Segments craft product subject and removes background clutter.
    2. Applies studio lighting, contrast, saturation, and sharpness normalization.
    3. Composes subject onto studio spotlight backdrop with soft drop-shadow.
    Returns enhanced JPEG image bytes.
    """
    with Image.open(io.BytesIO(image_bytes)) as raw_img:
        # 1. Automatic Background Removal & Product Segmentation
        product_rgba = remove_cluttered_background(raw_img)
        
        # 2. Extract RGB channels for Lighting & Color Normalization
        r, g, b, alpha = product_rgba.split()
        product_rgb = Image.merge("RGB", (r, g, b))
        
        enhancer = ImageEnhance.Contrast(product_rgb)
        product_rgb = enhancer.enhance(1.18)
        
        enhancer = ImageEnhance.Brightness(product_rgb)
        product_rgb = enhancer.enhance(1.06)
        
        enhancer = ImageEnhance.Color(product_rgb)
        product_rgb = enhancer.enhance(1.12)
        
        enhancer = ImageEnhance.Sharpness(product_rgb)
        product_rgb = enhancer.enhance(1.30)
        
        # Re-merge enhanced RGB with subject transparency alpha mask
        r2, g2, b2 = product_rgb.split()
        product_rgba = Image.merge("RGBA", (r2, g2, b2, alpha))
        
        # 3. Studio Backdrop & Drop Shadow Composition
        orig_w, orig_h = product_rgba.size
        target_w, target_h = max(600, orig_w), max(600, orig_h)
        
        colors = STUDIO_BACKDROP_PALETTES.get(backdrop_id, STUDIO_BACKDROP_PALETTES["royal_silk"])
        bg = create_radial_gradient_background(target_w, target_h, colors[0], colors[1])
        
        # Fit craft subject into studio frame with margin
        margin = int(min(target_w, target_h) * 0.08)
        max_craft_w = target_w - (2 * margin)
        max_craft_h = target_h - (2 * margin)
        
        scale = min(max_craft_w / float(orig_w), max_craft_h / float(orig_h))
        new_w = max(1, int(orig_w * scale))
        new_h = max(1, int(orig_h * scale))
        
        resized_product = product_rgba.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Create soft drop-shadow from subject alpha mask
        shadow_mask = resized_product.split()[3].filter(ImageFilter.GaussianBlur(radius=12))
        shadow = Image.new("RGBA", (new_w, new_h), (0, 0, 0, 110))
        
        offset_x = (target_w - new_w) // 2
        offset_y = (target_h - new_h) // 2
        
        # Paste drop shadow slightly offset
        bg.paste(shadow, (offset_x + 4, offset_y + 8), shadow_mask)
        
        # Paste segmented product subject onto studio backdrop spotlight
        bg.paste(resized_product, (offset_x, offset_y), resized_product)
        
        final_rgb = bg.convert("RGB")
        output_buffer = io.BytesIO()
        final_rgb.save(output_buffer, format="JPEG", quality=92)
        return output_buffer.getvalue()

async def enhance_studio_image(
    image_url_or_data: Optional[str],
    backdrop_id: str = "royal_silk"
) -> Tuple[str, bool, str]:
    """
    Asynchronously removes background clutter and enhances a product photo for the studio.
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
        
        return data_uri, True, "AI Studio background clutter removal, subject segmentation & lighting normalization applied."
        
    except Exception as e:
        logger.warning("[ImageEnhancer] Studio background removal fallback triggered: %s", str(e))
        return raw, False, "Photo enhancement unavailable. Original photo saved."
