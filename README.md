# Advanced Flare Map Editor (TMX Compatible)

Browser-only, dependency-free HTML+JS **map editor** for generating **Flare / Tiled TMX** maps. Supports 32x32 and 64x64 tile sizes, multiple layers, collision, objects, and properties.

## Features
Core Tile Editing:
- PNG tileset loading & slicing (32 or 64 tile size selectable)
- Multiple tile layers (create, reorder, rename, toggle visibility)
- Default layers: Ground, Wall, Decor
- Left click paint, right click erase (tile tool)

Collision Layer:
- Toggle to collision tool and paint passability (red overlay)
- Exported as `<layer name="Collision">`

Objects:
- Object tool: click to create rectangle (defaults to 1 tile size)
- Drag to move; drag corner (bottom-right) to resize
- Types: door, npc, spawn, event (customizable)
- Properties editor (add/remove arbitrary key/value)
- Exported in `<objectgroup name="Objects">` with `<properties>` blocks

Mini Map:
- Scaled preview rendering in real-time (approximate color sampling)

Export:
- TMX (`map.tmx`) with all tile layers + collision + objects
- TSX (`tileset.tsx`) embedding tileset PNG as Base64 (can change to file reference)

## File Structure
```
index.html  # UI layout & controls
style.css   # Basic styling
script.js   # Core logic: loading, painting, exporting
```

## How To Use
1. Open `index.html` in a modern browser.
2. Select tile size (32/64) and load a PNG tileset.
3. Use Tiles tool: pick a tile, paint with left click, erase with right click.
4. Use Layers panel to add/reorder/hide tile layers.
5. Switch to Collision tool to paint blocking cells.
6. Switch to Objects tool to place objects; drag to move; corner to resize.
7. Select an object to edit its name & properties; add new properties with the button.
8. Resize map dimensions as needed.
9. Export TMX + TSX; place both into your Flare project (or adjust tileset source path).

## TMX Output (Example Snippet)
```xml
<map orientation="orthogonal" tilewidth="32" tileheight="32" width="20" height="15">
  <tileset firstgid="1" name="main" tilewidth="32" tileheight="32" tilecount="X" columns="Y" source="tileset.tsx"/>
  <layer name="Ground">
    <data encoding="csv">...</data>
  </layer>
</map>
```

## Extending
See comments in `script.js`. Potential enhancements:
- Undo/redo command stack
- Import existing TMX (parse XML; populate layers/objects)
- Advanced object shapes (polygons, ellipses)
- Autotiling rules
- Brush patterns / rectangle fill / flood fill
- Camera & pan for huge maps
- Multiple tilesets (manage firstgid offsets)
- Export different property types (int, bool, etc.)

## Notes
- GIDs start at 1 for the first tileset.
- Empty tile = 0 in CSV data.
- Collision layer uses 0/1 values (0 passable, 1 blocked).
- Mini map is approximate (samples each tile's center pixel).
- TSX uses embedded Base64; replace with relative `source="tileset.png"` for large assets.
- No compression; Tiled supports base64+gzip/zlib if needed.

## License
Public Domain / Unlicense. Do whatever you want. Attribution appreciated but not required.
