from PIL import Image
import os

base = 'c:/Users/Max  Mao/.gemini/antigravity/coffee-demo-v2/assets/bg_final'
TARGET_W, TARGET_H = 1080, 1920
WEBP_QUALITY = 80

files = {
    'bg_wood_00000.webp': {'quality': WEBP_QUALITY},
    'bg_plants_00000.webp': {'quality': WEBP_QUALITY},
    'bg_pedal_00000.webp': {'quality': WEBP_QUALITY},
    'bg_cup_00000.webp': {'quality': WEBP_QUALITY},
    'bg_share_base.png': {'quality': WEBP_QUALITY, 'convert_to_webp': False},  # keep as PNG for canvas
}

for fname, opts in files.items():
    path = os.path.join(base, fname)
    if not os.path.exists(path):
        continue

    img = Image.open(path)
    old_size = os.path.getsize(path)

    # Preserve alpha if present
    has_alpha = img.mode in ('RGBA', 'LA', 'PA')

    # Resize if larger than target
    if img.size[0] > TARGET_W or img.size[1] > TARGET_H:
        img = img.resize((TARGET_W, TARGET_H), Image.LANCZOS)

    if fname.endswith('.webp'):
        # Save as lossy webp with alpha if needed
        img.save(path, 'WEBP', quality=opts['quality'], method=6)
    elif fname.endswith('.png'):
        # Compress PNG with optimize
        img.save(path, 'PNG', optimize=True)

    new_size = os.path.getsize(path)
    print(f'{fname}: {old_size/1024:.0f}KB -> {new_size/1024:.0f}KB ({(1-new_size/old_size)*100:.0f}% smaller)')
