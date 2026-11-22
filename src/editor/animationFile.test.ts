import { describe, expect, it } from 'vitest';
import { activeFrameIndexes, parseAnimationFile, parseColorMod, previewLayout, previewRect, serializeAnimationFile } from './animationFile';

const UNPACKED = `# demo

image=images/avatar/female/leather_hood.png
render_size=128,128
render_offset=64,96

[stance]
position=0
frames=4
duration=800ms
type=back_forth

[run]
position=4
frames=8
duration=533ms
type=looped
`;

const PACKED = `image=images/enemies/antlion.png

[stance]
frames=4
duration=533ms
type=back_forth
frame=0,0,800,153,153,137,66,96
frame=0,1,0,2792,195,148,97,100
frame=1,0,887,1495,150,135,66,94
`;

describe('animationFile', () => {
  it('parses unpacked sections and previews a grid cell', () => {
    const parsed = parseAnimationFile(UNPACKED);
    expect(parsed.headerKeys.images[0].file).toBe('images/avatar/female/leather_hood.png');
    expect(parsed.sections.map((section) => section.name)).toEqual(['stance', 'run']);
    expect(previewRect(parsed, parsed.sections[1], 1, 3)).toEqual({
      x: 128 * (4 + 1), y: 128 * 3, w: 128, h: 128, image: 'images/avatar/female/leather_hood.png', ox: 64, oy: 96,
    });
  });

  it('parses packed frames and round-trips comments', () => {
    const parsed = parseAnimationFile(PACKED);
    expect(parsed.sections[0].packed[1]).toMatchObject({ index: '0', direction: '1', x: '0', y: '2792', w: '195', h: '148' });
    const rect = previewRect(parsed, parsed.sections[0], 0, 1);
    expect(rect).toMatchObject({ x: 0, y: 2792, w: 195, h: 148, ox: 97, oy: 100 });
    const out = serializeAnimationFile(parseAnimationFile(UNPACKED));
    expect(out).toContain('# demo');
    expect(serializeAnimationFile(parseAnimationFile(out)).trim()).toBe(out.trim());
  });

  it('resolves active frames and packed frames that switch image mid-section', () => {
    expect([...activeFrameIndexes('all', 3)]).toEqual([0, 1, 2]);
    expect([...activeFrameIndexes('0, 2, 9', 3)]).toEqual([0, 2]);
    expect([...activeFrameIndexes('', 2)]).toEqual([]);

    const twoImages = parseAnimationFile(`image=images/a.png,first\nimage=images/b.png,second\n\n[stance]\nframes=2\nduration=200ms\ntype=looped\nframe=0,0,0,0,10,10,0,0,first\nframe=1,0,0,0,10,10,0,0,second\n`);
    expect(previewRect(twoImages, twoImages.sections[0], 0, 0)?.image).toBe('images/a.png');
    expect(previewRect(twoImages, twoImages.sections[0], 1, 0)?.image).toBe('images/b.png');
  });

  it('parses color_mod and places a frame at origin minus offset', () => {
    expect(parseColorMod('')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColorMod('128,0,64')).toEqual({ r: 128, g: 0, b: 64 });
    expect(previewLayout({ w: 128, h: 128, ox: 64, oy: 96 })).toEqual({
      canvasW: 128, canvasH: 128, originX: 64, originY: 96, destX: 0, destY: 0,
    });
    expect(previewLayout({ w: 153, h: 137, ox: 66, oy: 96 })).toEqual({
      canvasW: 153, canvasH: 137, originX: 66, originY: 96, destX: 0, destY: 0,
    });
  });
});
