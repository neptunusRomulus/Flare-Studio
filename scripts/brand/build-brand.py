#!/usr/bin/env python3
"""Builds the Flare Studio wordmark lockups (text converted to paths).

Needs (outside the repo): pip install uharfbuzz fonttools
Usage: python3 scripts/brand/build-brand.py <repo-root>
Reads assets/brand/flare-studio-icon.svg and assets/brand/fonts/ChakraPetch-Bold.ttf,
writes assets/brand/flare-studio-lockup-{horizontal,stacked}{,-light}.svg.
"""
import re, sys, os
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

root = sys.argv[1] if len(sys.argv) > 1 else '.'
brand = os.path.join(root, 'assets', 'brand')
font_path = os.path.join(brand, 'fonts', 'ChakraPetch-Bold.ttf')
TEXT = 'Flare Studio'
TRACK = 0  # font units of extra letter spacing

def text_path(size):
    blob = hb.Blob.from_file_path(font_path)
    face = hb.Face(blob); font = hb.Font(face)
    buf = hb.Buffer(); buf.add_str(TEXT); buf.guess_segment_properties()
    hb.shape(font, buf, {'kern': True, 'liga': True})
    tt = TTFont(font_path); gs = tt.getGlyphSet(); order = tt.getGlyphOrder()
    upm = tt['head'].unitsPerEm; s = size / upm
    pen = SVGPathPen(gs); bpen = BoundsPen(gs)
    x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        # flip y: font y-up -> svg y-down, baseline at 0
        t = (s, 0, 0, -s, (x + pos.x_offset) * s, -pos.y_offset * s)
        gs[name].draw(TransformPen(pen, t)); gs[name].draw(TransformPen(bpen, t))
        x += pos.x_advance + TRACK
    return pen.getCommands(), bpen.bounds  # bounds in svg coords (y flipped)

icon_svg = open(os.path.join(brand, 'flare-studio-icon.svg')).read()
icon_inner = re.search(r'<svg[^>]*>(.*)</svg>', icon_svg, re.S).group(1).strip()

def write(name, w, h, parts):
    with open(os.path.join(brand, name), 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}">\n{parts}\n</svg>\n')

for suffix, color in (('', '#F2F2F2'), ('-light', '#2B2B2B')):
    # Horizontal: 512 icon, text cap height ~ 45% of icon
    d, (x0, y0, x1, y1) = text_path(300)
    tw, th = x1 - x0, y1 - y0
    gap = 64; W = 512 + gap + tw; H = 512
    ty = (H - th) / 2 - y0
    write(f'flare-studio-lockup-horizontal{suffix}.svg', W + 16, H,
          f'<g>{icon_inner}</g>\n<path fill="{color}" transform="translate({512 + gap - x0:.2f} {ty:.2f})" d="{d}"/>')
    # Stacked: icon centred above text
    d, (x0, y0, x1, y1) = text_path(200)
    tw, th = x1 - x0, y1 - y0
    W = max(512, tw) + 32; gap = 56; H = 512 + gap + th + 24
    write(f'flare-studio-lockup-stacked{suffix}.svg', W, H,
          f'<g transform="translate({(W - 512) / 2:.2f} 0)">{icon_inner}</g>\n'
          f'<path fill="{color}" transform="translate({(W - tw) / 2 - x0:.2f} {512 + gap - y0:.2f})" d="{d}"/>')
print('ok')

# ---- Optional: pack app icons after `node scripts/brand/rasterize.mjs` (needs: pip install pillow)
if '--pack' in sys.argv:
    from PIL import Image
    icons = os.path.join(root, 'build', 'icons')
    sizes = [16, 24, 32, 48, 64, 128, 256]
    imgs = [Image.open(os.path.join(icons, f'{s}x{s}.png')).convert('RGBA') for s in sizes]
    imgs[-1].save(os.path.join(icons, 'flare.ico'), sizes=[(s, s) for s in sizes], append_images=imgs[:-1])
    big = Image.open(os.path.join(icons, '1024x1024.png')).convert('RGBA')
    big.save(os.path.join(icons, 'flare.icns'), append_images=[Image.open(os.path.join(icons, f'{s}x{s}.png')).convert('RGBA') for s in (16, 32, 64, 128, 256, 512)])
    print('packed ico/icns')
