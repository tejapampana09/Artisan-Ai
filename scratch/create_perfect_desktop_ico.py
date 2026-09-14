import os
from PIL import Image

# Load 1024x1024 high-res logo
logo = Image.open('C:/Users/tejap/.gemini/antigravity/brain/df6baa3c-1aad-4e64-ba0f-50c74fec43f3/.user_uploaded/media_1789386857470.png').convert('RGBA')

# Target ICO path on local machine
target_ico = r'c:\Users\tejap\Desktop\New folder (2)\frontend\public\app-desktop.ico'

sizes = [(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)]
frames = []

for size in sizes:
    s = size[0]
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    # 92% size for crisp transparent look on desktop
    logo_s = max(1, int(s * 0.92))
    resized = logo.resize((logo_s, logo_s), Image.Resampling.LANCZOS)
    pos = (s - logo_s) // 2
    canvas.paste(resized, (pos, pos), resized)
    frames.append(canvas)

frames[0].save(
    target_ico,
    format='ICO',
    sizes=[f.size for f in frames],
    append_images=frames[1:]
)

print("Generated app-desktop.ico successfully at:", target_ico)
