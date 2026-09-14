from PIL import Image, ImageFilter
import shutil
import os

source_path = 'C:/Users/tejap/.gemini/antigravity/brain/df6baa3c-1aad-4e64-ba0f-50c74fec43f3/.user_uploaded/media_1789386857470.png'
dest_clean = 'frontend/public/clean-logo-mark.png'

# Copy high-res 1024x1024 logo
shutil.copyfile(source_path, dest_clean)

logo = Image.open(dest_clean).convert('RGBA')

SANDALWOOD_BG = (251, 248, 243, 255) # #FBF8F3

def create_transparent_icon(size_px, scale_ratio=0.88):
    """Creates a transparent PNG icon for PC desktop shortcuts & web browser tabs."""
    canvas = Image.new('RGBA', (size_px, size_px), (0, 0, 0, 0))
    target_size = int(size_px * scale_ratio)
    resized_logo = logo.resize((target_size, target_size), Image.Resampling.LANCZOS)
    
    pos_x = (size_px - target_size) // 2
    pos_y = (size_px - target_size) // 2
    
    canvas.paste(resized_logo, (pos_x, pos_y), resized_logo)
    return canvas

def create_solid_icon(size_px, scale_ratio=0.70):
    """Creates a solid Sandalwood background PNG icon for Mobile App Launchers (maskable)."""
    canvas = Image.new('RGBA', (size_px, size_px), SANDALWOOD_BG)
    target_size = int(size_px * scale_ratio)
    resized_logo = logo.resize((target_size, target_size), Image.Resampling.LANCZOS)
    
    # Drop shadow calculation
    shadow_offset = max(2, int(size_px * 0.008))
    blur_radius = max(3, int(size_px * 0.015))
    
    alpha = resized_logo.split()[3]
    shadow_mask = Image.new('RGBA', (size_px, size_px), (0, 0, 0, 0))
    shadow_color = Image.new('RGBA', (target_size, target_size), (42, 30, 23, 40))
    
    pos_x = (size_px - target_size) // 2
    pos_y = (size_px - target_size) // 2
    
    shadow_mask.paste(shadow_color, (pos_x + shadow_offset, pos_y + shadow_offset), alpha)
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(blur_radius))
    
    canvas.paste(shadow_mask, (0, 0), shadow_mask)
    canvas.paste(resized_logo, (pos_x, pos_y), resized_logo)
    
    rgb_canvas = Image.new('RGB', (size_px, size_px), (251, 248, 243))
    rgb_canvas.paste(canvas, mask=canvas.split()[3])
    return rgb_canvas

# 1. PC / Desktop / Browser Icons (TRANSPARENT)
icon_512_any = create_transparent_icon(512, scale_ratio=0.88)
icon_192_any = create_transparent_icon(192, scale_ratio=0.88)
icon_64_trans = create_transparent_icon(64, scale_ratio=0.90)

icon_512_any.save('frontend/public/icon-512-any.png', 'PNG')
icon_192_any.save('frontend/public/icon-192-any.png', 'PNG')
icon_512_any.save('frontend/public/artisan-logo.png', 'PNG')

# Favicon ICO (Transparent)
icon_64_trans.save('frontend/public/favicon.ico', format='ICO', sizes=[(16,16), (32,32), (48,48), (64,64)])

# 2. Mobile Icons (SOLID SANDALWOOD #FBF8F3)
icon_512_maskable = create_solid_icon(512, scale_ratio=0.70)
icon_192_maskable = create_solid_icon(192, scale_ratio=0.70)
apple_touch_icon = create_solid_icon(180, scale_ratio=0.70)

icon_512_maskable.save('frontend/public/icon-512-maskable.png', 'PNG')
icon_192_maskable.save('frontend/public/icon-192-maskable.png', 'PNG')
apple_touch_icon.save('frontend/public/apple-touch-icon.png', 'PNG')

print("All high-res transparent PC & solid Mobile icons generated successfully!")
