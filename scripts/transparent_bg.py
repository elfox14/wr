from PIL import Image
import sys

def make_transparent(input_path, output_path, threshold=20):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        # If the pixel is very dark (close to black), make it transparent
        if item[0] <= threshold and item[1] <= threshold and item[2] <= threshold:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        make_transparent(sys.argv[1], sys.argv[1])
    else:
        make_transparent("public/brand/logo-full.png", "public/brand/logo-full.png", threshold=30)
        make_transparent("public/brand/logo-icon.png", "public/brand/logo-icon.png", threshold=30)
        make_transparent("public/brand/logo-horizontal.png", "public/brand/logo-horizontal.png", threshold=30)
