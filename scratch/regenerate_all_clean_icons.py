import shutil
import os
from PIL import Image, ImageFilter

source_logo_path = 'C:/Users/tejap/.gemini/antigravity/brain/df6baa3c-1aad-4e64-ba0f-50c74fec43f3/.user_uploaded/media_1789386857470.png'
dest_public = 'frontend/public'

# 1. Save master high-res clean logo mark
clean_path = os.path.join(dest_public, 'clean-logo-mark.png')
shutil.copyfile(source_logo_path, clean_path)

logo = Image.open(clean_path).convert('RGBA')

# Colors
SANDALWOOD_BG = (251, 248, 243, 255) # #FBF8F3

def make_transparent_icon(size_px, scale_ratio=0.88):
    canvas = Image.new('RGBA', (size_px, size_px), (0, 0, 0, 0))
    target_s = int(size_px * scale_ratio)
    resized = logo.resize((target_s, target_s), Image.Resampling.LANCZOS)
    pos_x = (size_px - target_s) // 2
    pos_y = (size_px - target_s) // 2
    canvas.paste(resized, (pos_x, pos_y), resized)
    return canvas

def make_solid_icon(size_px, scale_ratio=0.70):
    canvas = Image.new('RGBA', (size_px, size_px), SANDALWOOD_BG)
    target_s = int(size_px * scale_ratio)
    resized = logo.resize((target_s, target_s), Image.Resampling.LANCZOS)
    
    # Drop shadow
    shadow_offset = max(2, int(size_px * 0.008))
    blur_radius = max(3, int(size_px * 0.015))
    
    alpha = resized.split()[3]
    shadow_mask = Image.new('RGBA', (size_px, size_px), (0, 0, 0, 0))
    shadow_color = Image.new('RGBA', (target_s, target_s), (42, 30, 23, 40))
    
    pos_x = (size_px - target_s) // 2
    pos_y = (size_px - target_s) // 2
    
    shadow_mask.paste(shadow_color, (pos_x + shadow_offset, pos_y + shadow_offset), alpha)
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(blur_radius))
    
    canvas.paste(shadow_mask, (0, 0), shadow_mask)
    canvas.paste(resized, (pos_x, pos_y), resized)
    
    rgb_canvas = Image.new('RGB', (size_px, size_px), (251, 248, 243))
    rgb_canvas.paste(canvas, mask=canvas.split()[3])
    return rgb_canvas

# Generate Transparent Assets
icon_512_any = make_transparent_icon(512, scale_ratio=0.88)
icon_192_any = make_transparent_icon(192, scale_ratio=0.88)
artisan_logo = make_transparent_icon(512, scale_ratio=0.90)
icon_64_trans = make_transparent_icon(64, scale_ratio=0.90)

icon_512_any.save(os.path.join(dest_public, 'icon-512-any.png'), 'PNG')
icon_192_any.save(os.path.join(dest_public, 'icon-192-any.png'), 'PNG')
artisan_logo.save(os.path.join(dest_public, 'artisan-logo.png'), 'PNG')

# Generate Favicon ICO & App Desktop ICO
icon_64_trans.save(os.path.join(dest_public, 'favicon.ico'), format='ICO', sizes=[(16,16), (32,32), (48,48), (64,64)])

desktop_sizes = [(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)]
desktop_frames = [make_transparent_icon(s[0], scale_ratio=0.92) for s in desktop_sizes]
desktop_frames[0].save(
    os.path.join(dest_public, 'app-desktop.ico'),
    format='ICO',
    sizes=[f.size for f in desktop_frames],
    append_images=desktop_frames[1:]
)

# Generate Solid Mobile Assets
icon_512_maskable = make_solid_icon(512, scale_ratio=0.70)
icon_192_maskable = make_solid_icon(192, scale_ratio=0.70)
apple_touch_icon = make_solid_icon(180, scale_ratio=0.70)

icon_512_maskable.save(os.path.join(dest_public, 'icon-512-maskable.png'), 'PNG')
icon_192_maskable.save(os.path.join(dest_public, 'icon-192-maskable.png'), 'PNG')
apple_touch_icon.save(os.path.join(dest_public, 'apple-touch-icon.png'), 'PNG')

print("All clean icon assets regenerated successfully!")
