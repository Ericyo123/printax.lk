from PIL import Image

def trim_white_bg(input_path, output_path, tolerance=40):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    
    # First make everything close to white transparent
    new_data = []
    for item in data:
        if item[0] > 255 - tolerance and item[1] > 255 - tolerance and item[2] > 255 - tolerance:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
    img.putdata(new_data)
    
    # Now get bounding box of non-transparent pixels
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(output_path, "PNG")

trim_white_bg("public/logo.png", "public/logo_cropped.png")
print("Done cropping")
