from PIL import Image
import sys

def convert():
    og_in = r"C:\Users\TheFo\.gemini\antigravity-ide\brain\f822321d-778a-4d66-b276-f94ace7e2b6d\og_image_1780750314373.png"
    og_out = r"d:\world cup\public\og-image.jpg"
    
    logo_in = r"C:\Users\TheFo\.gemini\antigravity-ide\brain\f822321d-778a-4d66-b276-f94ace7e2b6d\worldcup_exchange_logo_1780750722498.png"
    apple_out = r"d:\world cup\public\apple-touch-icon.png"
    favicon_out = r"d:\world cup\public\favicon.ico"

    # og-image.jpg
    try:
        img = Image.open(og_in).convert("RGB")
        img = img.resize((1200, 630), Image.Resampling.LANCZOS)
        img.save(og_out, "JPEG", quality=90)
        print("og-image.jpg created")
    except Exception as e:
        print("Error with og-image:", e)

    # apple-touch-icon.png
    try:
        logo = Image.open(logo_in).convert("RGBA")
        apple = logo.resize((180, 180), Image.Resampling.LANCZOS)
        apple.save(apple_out, "PNG")
        print("apple-touch-icon.png created")
    except Exception as e:
        print("Error with apple-touch-icon:", e)

    # favicon.ico
    try:
        logo = Image.open(logo_in).convert("RGBA")
        favicon = logo.resize((64, 64), Image.Resampling.LANCZOS)
        favicon.save(favicon_out, format="ICO", sizes=[(64, 64)])
        print("favicon.ico created")
    except Exception as e:
        print("Error with favicon:", e)

if __name__ == '__main__':
    convert()
