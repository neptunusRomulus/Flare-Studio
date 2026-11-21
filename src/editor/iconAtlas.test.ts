import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ATLAS_COLUMNS,
  DEFAULT_ICON_SIZE,
  ICONS_PNG,
  INHERIT_ATLAS_WARNING,
  MOD_OVERRIDE_BUILD_WARNING,
  applyIconAssignments,
  applyIconAssignmentsToFiles,
  applyPackedAssignments,
  atlasMetrics,
  countNumericIconRefs,
  cropIconCell,
  markPending,
  normalizeIconCell,
  ownerKey,
  packIconAtlas,
  parseIconSize,
  parseOwnerKey,
  parseStudioIconMap,
  parseStudioStart,
  resolveIconWorkflow,
  resolveProjectIconAtlas,
  sectionForPowerPath,
  serializeStudioIconMap,
  shouldSkipProjectAtlasBuild,
  uniqueStudioFileName,
} from './iconAtlas';

const SIZE = DEFAULT_ICON_SIZE;

function cell(r: number, g: number, b: number, a = 255, size = SIZE): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = a;
  }
  return pixels;
}

function sample(pixels: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const i = (y * width + x) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
}

describe('parseIconSize', () => {
  it('reads icon_size from resolutions and defaults to 32', () => {
    expect(parseIconSize('icon_size=48\n')).toBe(48);
    expect(parseIconSize('icon_size=0\n')).toBe(DEFAULT_ICON_SIZE);
    expect(parseIconSize('')).toBe(DEFAULT_ICON_SIZE);
    expect(parseIconSize('# comment\nmenu_frame_width=32\n')).toBe(DEFAULT_ICON_SIZE);
  });
});

describe('uniqueStudioFileName', () => {
  it('keeps the first name and suffixes collisions', () => {
    expect(uniqueStudioFileName('Fire Ball.PNG', [])).toBe('Fire_Ball.png');
    expect(uniqueStudioFileName('fire.png', ['fire.png'])).toBe('fire_2.png');
    expect(uniqueStudioFileName('fire.png', ['fire.png', 'fire_2.png'])).toBe('fire_3.png');
  });
});

describe('normalizeIconCell', () => {
  it('copies a cell that is already the engine size', () => {
    const src = cell(10, 20, 30);
    src[0] = 7;
    expect([...normalizeIconCell(src, SIZE, SIZE, SIZE)]).toEqual([...src]);
    expect(normalizeIconCell(src, SIZE, SIZE, SIZE)).not.toBe(src);
  });

  it('scales a smaller square to fill the cell', () => {
    const src = cell(255, 0, 0, 255, 16);
    const out = normalizeIconCell(src, 16, 16, 32);
    expect(out.length).toBe(32 * 32 * 4);
    expect(sample(out, 32, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(sample(out, 32, 31, 31)).toEqual([255, 0, 0, 255]);
  });

  it('scales a non-square image to fit and centers it on a transparent square', () => {
    const src = cell(0, 255, 0, 255, 8);
    // 16x8 source: reuse first 16*8 pixels of a 16x16 buffer
    const wide = new Uint8ClampedArray(16 * 8 * 4);
    for (let i = 0; i < wide.length; i += 4) {
      wide[i + 1] = 255;
      wide[i + 3] = 255;
    }
    const out = normalizeIconCell(wide, 16, 8, 32);
    // scale = min(32/16, 32/8) = 2 → 32x16, centered at y=8
    expect(sample(out, 32, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(sample(out, 32, 0, 7)).toEqual([0, 0, 0, 0]);
    expect(sample(out, 32, 0, 8)).toEqual([0, 255, 0, 255]);
    expect(sample(out, 32, 31, 23)).toEqual([0, 255, 0, 255]);
    expect(sample(out, 32, 0, 24)).toEqual([0, 0, 0, 0]);
  });
});

describe('packIconAtlas', () => {
  it('builds a new gapless atlas with frozen default columns and indexes 0..n-1', () => {
    const packed = packIconAtlas({
      iconSize: SIZE,
      cells: [cell(255, 0, 0), cell(0, 255, 0), cell(0, 0, 255)].map((pixels) => ({ pixels })),
    });
    expect(packed.columns).toBe(DEFAULT_ATLAS_COLUMNS);
    expect(packed.width).toBe(DEFAULT_ATLAS_COLUMNS * SIZE);
    expect(packed.height).toBe(SIZE);
    expect(packed.assignments).toEqual([0, 1, 2]);
    expect(sample(packed.pixels, packed.width, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(sample(packed.pixels, packed.width, SIZE, 0)).toEqual([0, 255, 0, 255]);
    expect(sample(packed.pixels, packed.width, SIZE * 2, 0)).toEqual([0, 0, 255, 255]);
    expect(sample(packed.pixels, packed.width, SIZE * 3, 0)).toEqual([0, 0, 0, 0]);
  });

  it('appends after the last cell of an existing atlas and never remaps prior indexes', () => {
    const existing = packIconAtlas({
      iconSize: SIZE,
      cells: Array.from({ length: 32 }, (_, i) => ({ pixels: cell(i, 1, 2) })),
    });
    expect(existing.rows).toBe(2);
    expect(existing.existingCellCount).toBe(0);
    const snapshot = new Uint8ClampedArray(existing.pixels);
    const packed = packIconAtlas({
      iconSize: SIZE,
      existing: { width: existing.width, height: existing.height, pixels: existing.pixels },
      cells: [{ pixels: cell(9, 9, 9) }],
    });
    expect(packed.columns).toBe(DEFAULT_ATLAS_COLUMNS);
    expect(packed.width).toBe(existing.width);
    expect(packed.height).toBe(3 * SIZE);
    expect(packed.existingCellCount).toBe(32);
    expect(packed.assignments).toEqual([32]);
    expect(packed.pixels.slice(0, snapshot.length)).toEqual(snapshot);
    expect(sample(packed.pixels, packed.width, 0, SIZE * 2)).toEqual([9, 9, 9, 255]);
  });

  it('keeps a 1-column atlas 1-column when appending', () => {
    const existingPixels = cell(1, 2, 3);
    const packed = packIconAtlas({
      iconSize: SIZE,
      existing: { width: SIZE, height: SIZE, pixels: existingPixels },
      cells: [{ pixels: cell(4, 5, 6) }, { pixels: cell(7, 8, 9) }],
    });
    expect(packed.columns).toBe(1);
    expect(packed.width).toBe(SIZE);
    expect(packed.height).toBe(SIZE * 3);
    expect(packed.assignments).toEqual([1, 2]);
    expect(sample(packed.pixels, packed.width, 0, 0)).toEqual([1, 2, 3, 255]);
    expect(sample(packed.pixels, packed.width, 0, SIZE)).toEqual([4, 5, 6, 255]);
  });

  it('replaces an existing index in place and appends after the last cell of the image', () => {
    const existing = packIconAtlas({
      iconSize: SIZE,
      cells: [cell(1, 0, 0), cell(0, 1, 0), cell(0, 0, 1)].map((pixels) => ({ pixels })),
    });
    // A 16-column row has 16 cells even when only the first three are painted.
    // New indexes start at 16 so empty trailing cells are never overwritten.
    const packed = packIconAtlas({
      iconSize: SIZE,
      existing: { width: existing.width, height: existing.height, pixels: existing.pixels },
      cells: [{ pixels: cell(9, 9, 9), index: 1 }, { pixels: cell(8, 8, 8) }],
    });
    expect(packed.columns).toBe(existing.columns);
    expect(packed.height).toBe(SIZE * 2);
    expect(packed.assignments).toEqual([1, 16]);
    expect(sample(packed.pixels, packed.width, 0, 0)).toEqual([1, 0, 0, 255]);
    expect(sample(packed.pixels, packed.width, SIZE, 0)).toEqual([9, 9, 9, 255]);
    expect(sample(packed.pixels, packed.width, SIZE * 2, 0)).toEqual([0, 0, 1, 255]);
    expect(sample(packed.pixels, packed.width, 0, SIZE)).toEqual([8, 8, 8, 255]);
  });

  it('ignores leftover pixels that are not a multiple of icon_size', () => {
    const width = SIZE * 16 + 10;
    const height = SIZE * 2 + 5;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const metrics = atlasMetrics(width, height, SIZE);
    expect(metrics).toEqual({ columns: 16, rows: 2, cellCount: 32 });
    const packed = packIconAtlas({
      iconSize: SIZE,
      existing: { width, height, pixels },
      cells: [{ pixels: cell(3, 3, 3) }],
    });
    expect(packed.columns).toBe(16);
    expect(packed.width).toBe(SIZE * 16);
    expect(packed.height).toBe(SIZE * 3);
    expect(packed.assignments).toEqual([32]);
  });

  it('offsets new indexes by first_id after the last existing cell', () => {
    const existing = packIconAtlas({
      iconSize: SIZE,
      defaultColumns: 2,
      cells: [cell(1, 1, 1), cell(2, 2, 2)].map((pixels) => ({ pixels })),
    });
    const packed = packIconAtlas({
      iconSize: SIZE,
      firstId: 100,
      existing: { width: existing.width, height: existing.height, pixels: existing.pixels },
      cells: [{ pixels: cell(3, 3, 3) }],
    });
    expect(packed.columns).toBe(2);
    expect(packed.assignments).toEqual([102]);
    expect(cropIconCell(packed.pixels, packed.width, packed.height, SIZE, 102, 100)).toEqual(cell(3, 3, 3));
  });
});

describe('icon workflow and skip rules', () => {
  it('reads studioStart from project.json and derives inherit when a required mod provides icons', () => {
    expect(parseStudioStart('{"meta":{"studioStart":"template"}}')).toBe('template');
    expect(parseStudioStart('{"meta":{"studioStart":"scratch"}}')).toBe('scratch');
    expect(parseStudioStart('{"meta":{}}')).toBeNull();
    expect(resolveIconWorkflow({ studioStart: 'template', projectHasAtlas: false, requiredModProvidesIcons: true })).toEqual({
      workflow: 'inherit', source: 'marker',
    });
    expect(resolveIconWorkflow({ studioStart: 'scratch', projectHasAtlas: false, requiredModProvidesIcons: true })).toEqual({
      workflow: 'author', source: 'marker',
    });
    expect(resolveIconWorkflow({ studioStart: null, projectHasAtlas: false, requiredModProvidesIcons: true })).toEqual({
      workflow: 'inherit', source: 'derived',
    });
    expect(resolveIconWorkflow({ studioStart: null, projectHasAtlas: true, requiredModProvidesIcons: true })).toEqual({
      workflow: 'author', source: 'derived',
    });
    expect(resolveIconWorkflow({ studioStart: null, projectHasAtlas: false, requiredModProvidesIcons: false })).toEqual({
      workflow: 'author', source: 'derived',
    });
  });

  it('never auto-builds a project atlas in inherit mode, and needs confirm before shadowing a mod in author mode', () => {
    expect(shouldSkipProjectAtlasBuild({
      workflow: 'inherit', projectHasAtlas: false, importedSourceCount: 1,
    })).toEqual({ skip: true, reason: INHERIT_ATLAS_WARNING });
    expect(shouldSkipProjectAtlasBuild({
      workflow: 'author', projectHasAtlas: false, importedSourceCount: 1, requiredModProvidesIcons: true,
    })).toEqual({ skip: true, reason: MOD_OVERRIDE_BUILD_WARNING });
    expect(shouldSkipProjectAtlasBuild({
      workflow: 'author', projectHasAtlas: false, importedSourceCount: 1, requiredModProvidesIcons: true, overrideConfirmed: true,
    }).skip).toBe(false);
    expect(shouldSkipProjectAtlasBuild({
      workflow: 'author', projectHasAtlas: false, importedSourceCount: 1, requiredModProvidesIcons: false,
    }).skip).toBe(false);
    expect(shouldSkipProjectAtlasBuild({
      workflow: 'inherit', projectHasAtlas: true, importedSourceCount: 2,
    }).skip).toBe(false);
    expect(shouldSkipProjectAtlasBuild({
      workflow: 'inherit', projectHasAtlas: false, importedSourceCount: 0,
    }).skip).toBe(false);
  });
});

describe('countNumericIconRefs and assignments', () => {
  const powers = `[power]\nid=1\nname=Fire\nicon=12\n\n[power]\nid=2\nname=Ice\n`;
  const effects = `[effect]\nid=burn\nicon=4\n`;
  const items = `[item]\nid=10\nicon=7\n`;

  it('counts every numeric icon= in the project', () => {
    expect(countNumericIconRefs({ 'powers/powers.txt': powers, 'powers/effects.txt': effects, 'items/items.txt': items })).toBe(3);
  });

  it('writes icon= on the matching power or effect and leaves items alone', () => {
    const files = applyIconAssignmentsToFiles(
      { 'powers/powers.txt': powers, 'powers/effects.txt': effects, 'items/items.txt': items },
      { [ownerKey('power', '1')]: 40, [ownerKey('effect', 'burn')]: 41 },
    );
    expect(files['powers/powers.txt']).toContain('icon=40');
    expect(files['powers/powers.txt']).not.toContain('icon=12');
    expect(files['powers/effects.txt']).toContain('icon=41');
    expect(files['items/items.txt']).toBe(items);
    expect(sectionForPowerPath('powers/powers.txt')).toBe('power');
    expect(sectionForPowerPath('powers/effects.txt')).toBe('effect');
  });

  it('inserts icon= when the block did not have one', () => {
    const text = applyIconAssignments('[power]\nid=2\nname=Ice\n', 'power', { [ownerKey('power', '2')]: 5 });
    expect(text).toContain('icon=5');
  });
});

describe('studio map and project atlas target', () => {
  it('round-trips the map and tracks pending assignments', () => {
    const mapped = applyPackedAssignments(
      markPending(parseStudioIconMap(''), ownerKey('power', '1'), 'images/icons/studio/fire.png'),
      { [ownerKey('power', '1')]: 8 },
    );
    expect(mapped.indexes['power:1']).toBe(8);
    expect(mapped.pending).toEqual([]);
    expect(parseStudioIconMap(serializeStudioIconMap(mapped)).sources['power:1']).toBe('images/icons/studio/fire.png');
    expect(parseOwnerKey('power:1')).toEqual({ kind: 'power', id: '1' });
  });

  it('prefers an existing project icons.png and otherwise starts a new one at first_id 0', () => {
    expect(resolveProjectIconAtlas({ projectHasFile: (rel) => rel === ICONS_PNG, iconsTxt: '' })).toEqual({
      rel: ICONS_PNG,
      firstId: 0,
      exists: true,
    });
    expect(resolveProjectIconAtlas({
      projectHasFile: (rel) => rel === 'images/icons/custom.png',
      iconsTxt: 'icon_set=20,images/icons/custom.png\n',
    })).toEqual({ rel: 'images/icons/custom.png', firstId: 20, exists: true });
    expect(resolveProjectIconAtlas({ projectHasFile: () => false, iconsTxt: '' })).toEqual({
      rel: ICONS_PNG,
      firstId: 0,
      exists: false,
    });
  });
});
