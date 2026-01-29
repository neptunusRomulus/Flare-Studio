from PIL import Image, ImageDraw
import os

# Change to public directory
os.chdir('public')

# Create 4 default tilesets (256x32 = 4 tiles of 64x32)
# Matching the collision tileset format

tilesets = {
    'background_tileset.png': {
        'color': (34, 139, 34),  # Forest green for ground
        'name': 'Background'
    },
    'object_tileset.png': {
        'color': (139, 69, 19),  # Brown for objects
        'name': 'Object'
    },
    'npc_tileset.png': {
        'color': (70, 130, 180),  # Steel blue for NPCs
        'name': 'NPC'
    },
    'enemy_tileset.png': {
        'color': (220, 20, 60),  # Crimson for enemies
        'name': 'Enemy'
    }
}

for filename, config in tilesets.items():
    # Create a 256x32 image (4 tiles of 64x32)
    img = Image.new('RGBA', (256, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw 4 tiles
    for i in range(4):
        x = i * 64
        # Draw a filled rectangle for each tile
        color = config['color']
        draw.rectangle([x, 0, x+64, 32], fill=color + (200,))
        # Draw a border around each tile
        draw.rectangle([x, 0, x+64, 32], outline=(255, 255, 255, 255), width=1)
        # Add a simple pattern
        for j in range(0, 64, 8):
            draw.line([(x+j, 0), (x+j, 32)], fill=(255, 255, 255, 100), width=1)
    
    img.save(filename)
    print(f"Created {filename}")

print("All default tilesets created successfully!")
