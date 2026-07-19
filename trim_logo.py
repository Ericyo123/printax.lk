from PIL import Image, ImageChops

def trim_and_remove_bg(image_path, output_path):
    img = Image.open(image_path).convert("RGBA")
    
    # Get the bounding box of the non-white area
    bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
    diff = ImageChops.difference(img, bg)
    diff = ImageChops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()
    
    if bbox:
        img = img.crop(bbox)
        
    # Make white pixels transparent
    data = img.getdata()
    new_data = []
    for item in data:
        # If the pixel is close to white, make it transparent
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(output_path, "PNG")

trim_and_remove_bg("public/logo.png", "public/logo_transparent.png")
print("Done")
