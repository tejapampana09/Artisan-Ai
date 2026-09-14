from PIL import Image, ImageFilter
import os

source_path = 'C:/Users/tejap/.gemini/antigravity/brain/df6baa3c-1aad-4e64-ba0f-50c74fec43f3/.user_uploaded/media_1789386857470.png'
raw_logo = Image.open(source_path).convert('RGBA')

# Step 1: Crop tight bounding box to eliminate any hidden transparent margins
bbox = raw_logo.getbbox()
tight_logo = raw_logo.crop(bbox)

print("Tight logo bounding box size:", tight_logo.size)

# Colors
SANDALWOOD_BG = (251, 248, 243, 255) # #FBF8F3

def create_uncropped_maskable_icon(size_px, target_ratio=0.55):
    """
    Creates a maskable icon where the tight logo mark occupies exactly target_ratio (55%) of the canvas.
    This guarantees 100% safe zone compliance on Samsung One UI squircles, Pixel circles, Xiaomi, and iOS.
    """
    canvas = Image.new('RGBA', (size_px, size_px), SANDALWOOD_BG)
    
    # Maintain aspect ratio of tight_logo
    w, h = tight_logo.size
    max_dim = max(w, h)
    
    target_max = int(size_px * target_ratio)
    scale = target_max / float(max_dim)
    
    new_w = int(w * scale)
    new_h = int(h * scale)
    
    resized_logo = tight_logo.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Warm subtle drop shadow
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

# Generate uncropped maskable icons
icon_512_maskable = create_uncropped_maskable_icon(512, target_ratio=0.54)
icon_192_maskable = create_uncropped_maskable_icon(192, target_ratio=0.54)
apple_touch_icon = create_uncropped_maskable_icon(180, target_ratio=0.54)

# Save to public
icon_512_maskable.save('frontend/public/icon-512-maskable.png', 'PNG')
icon_192_maskable.save('frontend/public/icon-192-maskable.png', 'PNG')
apple_touch_icon.save('frontend/public/apple-touch-icon.png', 'PNG')

print("Uncropped mobile maskable icons generated successfully!")
