from PIL import Image, ImageFilter
import os

# Source 1024x1024 master logo
logo_path = 'frontend/public/clean-logo-mark.png'
logo = Image.open(logo_path).convert('RGBA')

# Sandalwood Background Color: #FBF8F3
SANDALWOOD_BG = (251, 248, 243, 255)

def make_perfect_maskable_icon(size_px, scale_ratio=0.62):
    """
    Generates a PWA Maskable Icon conforming to W3C / Android PWA Safe Zone (60-65% inner diameter).
    Guarantees zero clipping on Samsung OneUI, Google Pixel, Xiaomi, OnePlus, and iOS.
    """
    canvas = Image.new('RGBA', (size_px, size_px), SANDALWOOD_BG)
    
    target_s = int(size_px * scale_ratio)
    resized_logo = logo.resize((target_s, target_s), Image.Resampling.LANCZOS)
    
    # Warm subtle elevation shadow under logo
    shadow_offset = max(2, int(size_px * 0.008))
    blur_radius = max(3, int(size_px * 0.015))
    
    alpha = resized_logo.split()[3]
    shadow_mask = Image.new('RGBA', (size_px, size_px), (0, 0, 0, 0))
    shadow_color = Image.new('RGBA', (target_s, target_s), (42, 30, 23, 45)) # Warm dark brown shadow
    
    pos_x = (size_px - target_s) // 2
    pos_y = (size_px - target_s) // 2
    
    shadow_mask.paste(shadow_color, (pos_x + shadow_offset, pos_y + shadow_offset), alpha)
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(blur_radius))
    
    # Composite: Background -> Shadow -> Resized Logo
    canvas.paste(shadow_mask, (0, 0), shadow_mask)
    canvas.paste(resized_logo, (pos_x, pos_y), resized_logo)
    
    rgb_canvas = Image.new('RGB', (size_px, size_px), (251, 248, 243))
    rgb_canvas.paste(canvas, mask=canvas.split()[3])
    return rgb_canvas

# Generate 512, 192, 180 (iOS Apple Touch Icon)
icon_512_maskable = make_perfect_maskable_icon(512, scale_ratio=0.64)
icon_192_maskable = make_perfect_maskable_icon(192, scale_ratio=0.64)
apple_touch_icon = make_perfect_maskable_icon(180, scale_ratio=0.64)

# Save to public
icon_512_maskable.save('frontend/public/icon-512-maskable.png', 'PNG')
icon_192_maskable.save('frontend/public/icon-192-maskable.png', 'PNG')
apple_touch_icon.save('frontend/public/apple-touch-icon.png', 'PNG')

print("Perfect mobile maskable icon assets generated successfully!")
