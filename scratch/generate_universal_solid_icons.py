from PIL import Image, ImageFilter
import os

source_path = 'C:/Users/tejap/.gemini/antigravity/brain/df6baa3c-1aad-4e64-ba0f-50c74fec43f3/.user_uploaded/media_1789386857470.png'
raw_logo = Image.open(source_path).convert('RGBA')

# 1. Tight crop logo mark (1007x853)
tight_logo = raw_logo.crop(raw_logo.getbbox())

SANDALWOOD_RGB = (251, 248, 243) # Pure solid #FBF8F3 (No alpha transparency)

def create_solid_pwa_icon(size_px, logo_scale_ratio=0.50):
    """
    Creates a 100% SOLID Sandalwood PNG icon with ZERO transparent pixels.
    Logo mark is centered at 50% max dimension, providing 25% solid Sandalwood padding on all 4 sides.
    This guarantees 0% cropping and 0% white backgrounds on Android WebAPK, Samsung, Pixel, Xiaomi, iOS, and PC.
    """
    # Solid RGB canvas
    canvas = Image.new('RGB', (size_px, size_px), SANDALWOOD_RGB)
    
    w, h = tight_logo.size
    target_max = int(size_px * logo_scale_ratio)
    scale = target_max / float(max(w, h))
    
    new_w = int(w * scale)
    new_h = int(h * scale)
    
    resized_logo = tight_logo.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Soft warm drop shadow
    shadow_offset = max(2, int(size_px * 0.008))
    blur_radius = max(3, int(size_px * 0.012))
    
    alpha = resized_logo.split()[3]
    shadow_mask = Image.new('RGBA', (size_px, size_px), (0, 0, 0, 0))
    shadow_color = Image.new('RGBA', (new_w, new_h), (42, 30, 23, 40))
    
    pos_x = (size_px - new_w) // 2
    pos_y = (size_px - new_h) // 2
    
    shadow_mask.paste(shadow_color, (pos_x + shadow_offset, pos_y + shadow_offset), alpha)
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(blur_radius))
    
    # Create RGBA layer to composite shadow + logo onto solid Sandalwood RGB canvas
    rgba_layer = Image.new('RGBA', (size_px, size_px), (251, 248, 243, 255))
    rgba_layer.paste(shadow_mask, (0, 0), shadow_mask)
    rgba_layer.paste(resized_logo, (pos_x, pos_y), resized_logo)
    
    canvas.paste(rgba_layer, (0, 0))
    return canvas

# Generate 512, 192, 180 solid icons
icon_512 = create_solid_pwa_icon(512, logo_scale_ratio=0.50)
icon_192 = create_solid_pwa_icon(192, logo_scale_ratio=0.50)
icon_180 = create_solid_pwa_icon(180, logo_scale_ratio=0.50)

# Save ALL PWA PNG icons as solid Sandalwood PNGs
icon_512.save('frontend/public/icon-512-any.png', 'PNG')
icon_512.save('frontend/public/icon-512-maskable.png', 'PNG')
icon_512.save('frontend/public/artisan-logo.png', 'PNG')

icon_192.save('frontend/public/icon-192-any.png', 'PNG')
icon_192.save('frontend/public/icon-192-maskable.png', 'PNG')

icon_180.save('frontend/public/apple-touch-icon.png', 'PNG')

print("All PWA PNG icons generated with 100% solid Sandalwood fill and 50% logo ratio!")
