import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  alignToScreenEdge,
  DEFAULT_RESOLUTIONS,
  formatPos,
  mergeMenuPos,
  parseMenuText,
  parsePos,
  parseResolutionsText,
  posFromScreen,
  viewSize,
} from './menuLayout';

const inventory = readFileSync('/tmp/fg-ref/menus/inventory.txt', 'utf8');
const actionbar = readFileSync('/tmp/fg-ref/menus/actionbar.txt', 'utf8');
const minimap = readFileSync('/tmp/fg-ref/menus/minimap.txt', 'utf8');

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

describe('mergeMenuPos', () => {
  it('rewrites only pos and keeps the rest of a real menu file', () => {
    const next = mergeMenuPos(inventory, { x: 10, y: -20, w: 640, h: 832 });
    expect(next.startsWith('pos=10,-20,640,832\n')).toBe(true);
    expect(next.slice(next.indexOf('\n') + 1)).toBe(inventory.slice(inventory.indexOf('\n') + 1));
    expect(mergeMenuPos(actionbar, parseMenuText(actionbar).pos)).toBe(actionbar.endsWith('\n') ? actionbar : `${actionbar}\n`);
    expect(parseMenuText(minimap).align).toBe('topright');
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
