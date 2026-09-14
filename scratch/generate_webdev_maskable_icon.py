from PIL import Image, ImageFilter
import os

source_path = 'C:/Users/tejap/.gemini/antigravity/brain/df6baa3c-1aad-4e64-ba0f-50c74fec43f3/.user_uploaded/media_1789386857470.png'
raw_logo = Image.open(source_path).convert('RGBA')

# 1. Crop tight bounding box (1007x853)
tight_logo = raw_logo.crop(raw_logo.getbbox())

SANDALWOOD_BG = (251, 248, 243, 255) # Opaque #FBF8F3

def create_webdev_maskable_icon(size_px):
    """
    Creates a Maskable Icon matching Google Web.dev & W3C PWA 40% Safe Zone Radius rules.
    - Outer 20% margin is reserved for Android OS masking (Samsung squircle / Pixel circle).
    - Inner 80% circle contains the complete logo mark with zero risk of cropping.
    """
    canvas = Image.new('RGBA', (size_px, size_px), SANDALWOOD_BG)
    
    # Safe zone diameter is 80% of icon size (40% radius)
    # Inside 80% safe circle, logo max dimension should fit comfortably (e.g. 62% of size_px)
    target_max_dim = int(size_px * 0.62)
    
    w, h = tight_logo.size
    scale = target_max_dim / float(max(w, h))
    
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
    
    canvas.paste(shadow_mask, (0, 0), shadow_mask)
    canvas.paste(resized_logo, (pos_x, pos_y), resized_logo)
    
    rgb_canvas = Image.new('RGB', (size_px, size_px), (251, 248, 243))
    rgb_canvas.paste(canvas, mask=canvas.split()[3])
    return rgb_canvas

# Generate Web.dev compliant maskable icons
icon_512_maskable = create_webdev_maskable_icon(512)
icon_192_maskable = create_webdev_maskable_icon(192)
apple_touch_icon = create_webdev_maskable_icon(180)

# Save to public
icon_512_maskable.save('frontend/public/icon-512-maskable.png', 'PNG')
icon_192_maskable.save('frontend/public/icon-192-maskable.png', 'PNG')
apple_touch_icon.save('frontend/public/apple-touch-icon.png', 'PNG')

print("Web.dev 40% safe zone maskable icons generated successfully!")
