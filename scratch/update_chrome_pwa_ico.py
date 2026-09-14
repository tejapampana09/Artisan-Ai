import glob
import os
from PIL import Image

# Source 1024x1024 clean logo
logo = Image.open('frontend/public/clean-logo-mark.png').convert('RGBA')

def make_clean_ico(target_ico_path, background_type='transparent'):
    sizes = [(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)]
    frames = []
    
    for size in sizes:
        s = size[0]
        if background_type == 'transparent':
            canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
            logo_s = int(s * 0.90)
            resized = logo.resize((logo_s, logo_s), Image.Resampling.LANCZOS)
            pos = (s - logo_s) // 2
            canvas.paste(resized, (pos, pos), resized)
        else: # sandalwood
            canvas = Image.new('RGBA', (s, s), (251, 248, 243, 255))
            logo_s = int(s * 0.75)
            resized = logo.resize((logo_s, logo_s), Image.Resampling.LANCZOS)
            pos = (s - logo_s) // 2
            canvas.paste(resized, (pos, pos), resized)
            
        frames.append(canvas)
        
    frames[0].save(
        target_ico_path,
        format='ICO',
        sizes=[f.size for f in frames],
        append_images=frames[1:]
    )
    print(f"Updated ICO ({background_type}) at {target_ico_path}")

# Find Chrome's PWA ico location
chrome_pwa_ico_files = glob.glob(r'C:\Users\tejap\AppData\Local\Google\Chrome\User Data\Default\Web Applications\_crx_*\*.ico')

for ico_file in chrome_pwa_ico_files:
    make_clean_ico(ico_file, background_type='transparent')

