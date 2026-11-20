import { describe, expect, it } from 'vitest';
import { tabToMenuPosition } from './menuLayout';
import {
  TREE_MAX_ZOOM,
  TREE_MIN_ZOOM,
  clampTreeZoom,
  fitTreeView,
  panTreeByScreen,
  screenFromTree,
  treeFromScreen,
  treeZoomPercent,
  zoomTreeAt,
} from './powerTreeView';

const tabArea = { x: 64, y: 60, w: 512, h: 672 };

describe('powerTreeView', () => {
  it('clamps zoom to 25%–400%', () => {
    expect(clampTreeZoom(0)).toBe(1);
    expect(clampTreeZoom(0.1)).toBe(TREE_MIN_ZOOM);
    expect(clampTreeZoom(8)).toBe(TREE_MAX_ZOOM);
    expect(treeZoomPercent(1)).toBe(100);
    expect(treeZoomPercent(0.25)).toBe(25);
    expect(treeZoomPercent(4)).toBe(400);
  });

  it('round-trips screen and tree coordinates at any pan and zoom', () => {
    const view = { zoom: 1.6, panX: 40, panY: -12 };
    const tree = { x: 32, y: 76 };
    const screen = screenFromTree(tree, view);
    const back = treeFromScreen(screen, view);
    expect(back.x).toBeCloseTo(tree.x);
    expect(back.y).toBeCloseTo(tree.y);
  });

  it('keeps the tree point under the cursor when zooming', () => {
    const view = { zoom: 1, panX: 10, panY: -20 };
    const cursor = { x: 200, y: 80 };
    const held = treeFromScreen(cursor, view);
    const next = zoomTreeAt(view, 2, cursor);
    const after = treeFromScreen(cursor, next);
    expect(next.zoom).toBe(2);
    expect(after.x).toBeCloseTo(held.x);
    expect(after.y).toBeCloseTo(held.y);
    expect(screenFromTree(held, next).x).toBeCloseTo(cursor.x);
  });

  it('converts a screen drag into the same menu position at any zoom and pan', () => {
    const start = { x: 32, y: 76 };
    expect(tabToMenuPosition(start, tabArea, 0)).toBe('96,136');
    const view = { zoom: 2, panX: 10, panY: -20 };
    const screen0 = screenFromTree(start, view);
    const moved = treeFromScreen({ x: screen0.x + 32, y: screen0.y }, view);
    expect(moved.x).toBeCloseTo(48);
    expect(moved.y).toBeCloseTo(76);
    expect(tabToMenuPosition(moved, tabArea, 0)).toBe('112,136');
    expect(tabToMenuPosition({ x: 48, y: 68 }, tabArea, 16)).toBe('112,128');
    expect(panTreeByScreen(view, 32, 0)).toEqual({ zoom: 2, panX: 26, panY: -20 });
  });

  it('fits and centers the tab area in the frame', () => {
    const view = fitTreeView(256, 336, 512, 672);
    expect(view.zoom).toBe(0.5);
    expect(treeFromScreen({ x: 128, y: 168 }, view)).toEqual({ x: 256, y: 336 });
  });
});
