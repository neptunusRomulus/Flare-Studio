import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  alignToScreenEdge,
  DEFAULT_RESOLUTIONS,
  formatPos,
  mergeMenuPos,
  mergeMenuSettings,
  parseMenuText,
  parsePowersMenuLayout,
  menuToTabPoint,
  tabToMenuPosition,
  DEFAULT_POWERS_MENU_POS,
  DEFAULT_POWERS_TAB_AREA,
  parsePos,
  parseResolutionsText,
  posFromScreen,
  viewSize,
  isHudMenu,
  visibleMenuFiles,
  MAIN_MENU_FILES,
} from './menuLayout';

function readFlareGameFile(...rels: string[]): string | null {
  const roots = [
    process.env.FLARE_GAME,
    path.resolve(__dirname, '../../../flare-game'),
    path.resolve(process.cwd(), '../flare-game'),
    '/tmp/fg-ref',
  ].filter(Boolean) as string[];
  for (const root of roots) {
    for (const rel of rels) {
      const full = path.join(root, rel);
      if (existsSync(full)) return readFileSync(full, 'utf8');
    }
  }
  return null;
}

const inventory = readFlareGameFile(
  'mods/fantasycore/menus/inventory.txt',
  'menus/inventory.txt',
);
const actionbar = readFlareGameFile(
  'mods/fantasycore/menus/actionbar.txt',
  'menus/actionbar.txt',
);
const minimap = readFlareGameFile(
  'mods/fantasycore/menus/minimap.txt',
  'menus/minimap.txt',
);
const hasMenus = Boolean(inventory && actionbar && minimap);

describe('viewSize', () => {
  it('picks virtual height and letterboxes like the engine', () => {
    expect(viewSize(1920, 1080, DEFAULT_RESOLUTIONS)).toEqual({ viewW: 1920, viewH: 1080 });
    expect(viewSize(1280, 720, DEFAULT_RESOLUTIONS)).toEqual({ viewW: 1706, viewH: 960 });
    expect(viewSize(640, 480, DEFAULT_RESOLUTIONS)).toEqual({ viewW: 1674, viewH: 960 });
  });
});

describe('alignToScreenEdge', () => {
  it('places right-aligned inventory and bottom actionbar', () => {
    const view = { w: 1920, h: 1080 };
    const inv = parsePos('0,-35,640,832');
    const right = alignToScreenEdge(inv, 'right', view.w, view.h);
    expect(right).toEqual({ x: 1920 - 640, y: Math.floor(1080 / 2) - Math.floor(832 / 2) - 35, w: 640, h: 832 });
    const bar = parsePos('0,0,1280,70');
    const bottom = alignToScreenEdge(bar, 'bottom', view.w, view.h);
    expect(bottom).toEqual({ x: Math.floor(1920 / 2) - Math.floor(1280 / 2), y: 1080 - 70, w: 1280, h: 70 });
  });

  it('inverts a drag back to the original pos', () => {
    const pos = parsePos('0,-35,640,832');
    const screen = alignToScreenEdge(pos, 'right', 1920, 1080);
    expect(posFromScreen({ x: screen.x, y: screen.y }, { w: 640, h: 832 }, 'right', 1920, 1080)).toEqual(pos);
    const moved = posFromScreen({ x: screen.x - 20, y: screen.y + 10 }, { w: 640, h: 832 }, 'right', 1920, 1080);
    expect(moved).toEqual({ x: -20, y: -25, w: 640, h: 832 });
  });
});

describe.skipIf(!hasMenus)('mergeMenuPos', () => {
  it('rewrites only pos and keeps the rest of a real menu file', () => {
    const next = mergeMenuPos(inventory!, { x: 10, y: -20, w: 640, h: 832 });
    expect(next.startsWith('pos=10,-20,640,832\n')).toBe(true);
    expect(next.slice(next.indexOf('\n') + 1)).toBe(inventory!.slice(inventory!.indexOf('\n') + 1));
    expect(mergeMenuPos(actionbar!, parseMenuText(actionbar!).pos)).toBe(actionbar!.endsWith('\n') ? actionbar! : `${actionbar!}\n`);
    expect(parseMenuText(minimap!).align).toBe('topright');
  });
});

describe('mergeMenuSettings', () => {
  it('updates common menu keys and keeps comments/unknown keys', () => {
    const text = 'pos=1,2,300,400\nalign=right\n# keep\nbackground=old.png\nenabled=false\nunknown=yes\n';
    const next = mergeMenuSettings(text, {
      pos: { x: 10, y: 20, w: 300, h: 400 },
      align: 'center',
      background: 'new.png',
      soundfxOpen: 'soundfx/open.ogg',
      soundfxClose: '',
      enabled: 'true',
    });
    expect(next).toContain('pos=10,20,300,400');
    expect(next).toContain('align=center');
    expect(next).toContain('background=new.png');
    expect(next).toContain('soundfx_open=soundfx/open.ogg');
    expect(next).toContain('enabled=true');
    expect(next).toContain('# keep');
    expect(next).toContain('unknown=yes');
    expect(next).not.toContain('soundfx_close=');
  });
});

describe('menu extra settings', () => {
  it('keeps repeated action bar keys and rewrites them in place', () => {
    const text = 'pos=0,0,1280,70\nslot=1,64,6\nslot=2,128,6\nunknown=yes\n';
    const parsed = parseMenuText(text, 'menus/actionbar.txt');
    expect(parsed.values.slot).toEqual(['1,64,6', '2,128,6']);
    expect(parsed.values.unknown).toEqual(['yes']);
    const next = mergeMenuSettings(text, {
      ...parsed,
      values: { ...parsed.values, slot: ['1,80,10,true', '2,128,6'] },
    });
    expect(next).toContain('slot=1,80,10,true');
    expect(next).toContain('slot=2,128,6');
    expect(next).toContain('unknown=yes');
  });

  it('adds stat bar keys without touching unknown lines', () => {
    const text = 'pos=4,4,512,32\nbar_pos=0,0,512,32\n# keep\n';
    const parsed = parseMenuText(text, 'menus/hp.txt');
    const next = mergeMenuSettings(text, {
      ...parsed,
      values: { ...parsed.values, bar_gfx: ['images/menus/hp.png'], hide_timeout: ['10s'] },
    });
    expect(next).toContain('bar_gfx=images/menus/hp.png');
    expect(next).toContain('hide_timeout=10s');
    expect(next).toContain('bar_pos=0,0,512,32');
    expect(next).toContain('# keep');
  });
});

describe('parseResolutionsText', () => {
  it('reads fantasycore values', () => {
    const text = `menu_frame_width=1674
menu_frame_height=960
required_width=1280
required_height=720
virtual_height=960,1080,1440
`;
    expect(parseResolutionsText(text)).toMatchObject({
      frameW: 1674,
      frameH: 960,
      minScreenW: 1280,
      minScreenH: 720,
      virtualHeights: [960, 1080, 1440],
    });
    expect(formatPos(parsePos('4,4,512,32'))).toBe('4,4,512,32');
  });
});

describe('visibleMenuFiles', () => {
  it('treats the HUD bars and plates as always-on', () => {
    expect(isHudMenu('menus/hp.txt')).toBe(true);
    expect(isHudMenu('minimap.txt')).toBe(true);
    expect(isHudMenu('menus/inventory.txt')).toBe(false);
    expect(isHudMenu('vendor.txt')).toBe(false);
  });

  it('shows only the HUD until a non-HUD menu is selected', () => {
    const files = MAIN_MENU_FILES.map((name) => `menus/${name}`);
    const visible = visibleMenuFiles(files, '', false);
    expect([...visible].map((f) => f.replace(/^menus\//, '')).sort()).toEqual([
      'actionbar.txt', 'activeeffects.txt', 'enemy.txt', 'hp.txt', 'hudlog.txt', 'minimap.txt', 'mp.txt', 'xp.txt',
    ]);
    expect(visible.has('menus/inventory.txt')).toBe(false);
  });

  it('adds the selected page without bringing the other exclusive menus', () => {
    const files = MAIN_MENU_FILES.map((name) => `menus/${name}`);
    const visible = visibleMenuFiles(files, 'menus/inventory.txt', false);
    expect(visible.has('menus/inventory.txt')).toBe(true);
    expect(visible.has('menus/hp.txt')).toBe(true);
    expect(visible.has('menus/character.txt')).toBe(false);
    expect(visible.has('menus/vendor.txt')).toBe(false);
  });

  it('shows every panel when asked', () => {
    const files = MAIN_MENU_FILES.map((name) => `menus/${name}`);
    expect(visibleMenuFiles(files, '', true).size).toBe(files.length);
  });

  it('reads tab_area from menus/powers.txt and falls back to Fantasy Core', () => {
    const text = 'pos=0,-35,640,832\nalign=center\ntab_area=64,60,512,672\n';
    const parsed = parseMenuText(text, 'menus/powers.txt');
    expect(parsed.tabArea).toEqual({ x: 64, y: 60, w: 512, h: 672 });
    expect(parsePowersMenuLayout('')).toEqual({ pos: DEFAULT_POWERS_MENU_POS, tabArea: DEFAULT_POWERS_TAB_AREA, background: undefined });
    expect(menuToTabPoint({ x: 96, y: 136 }, DEFAULT_POWERS_TAB_AREA)).toEqual({ x: 32, y: 76 });
    expect(tabToMenuPosition({ x: 32, y: 76 }, DEFAULT_POWERS_TAB_AREA, 0)).toBe('96,136');
    expect(tabToMenuPosition({ x: 32, y: 68 }, DEFAULT_POWERS_TAB_AREA, 16)).toBe('96,128');
  });
});
