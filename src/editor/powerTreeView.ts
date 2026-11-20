import { panForZoomAt } from '@/editor/wheelNav';

/** Match the brief: 25%–400%. The map canvas is slightly wider (10%–500%). */
export const TREE_MIN_ZOOM = 0.25;
export const TREE_MAX_ZOOM = 4;
/** Same step as TileMapEditor.zoomIn / zoomOut. */
export const TREE_ZOOM_STEP = 1.2;

export type TreeView = { zoom: number; panX: number; panY: number };

export function clampTreeZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return 1;
  return Math.min(TREE_MAX_ZOOM, Math.max(TREE_MIN_ZOOM, zoom));
}

/** screen = (tree + pan) * zoom, with pan in tree pixels and screen relative to the viewport. */
export function screenFromTree(tree: { x: number; y: number }, view: TreeView): { x: number; y: number } {
  return {
    x: (tree.x + view.panX) * view.zoom,
    y: (tree.y + view.panY) * view.zoom,
  };
}

export function treeFromScreen(screen: { x: number; y: number }, view: TreeView): { x: number; y: number } {
  return {
    x: screen.x / view.zoom - view.panX,
    y: screen.y / view.zoom - view.panY,
  };
}

export function centerTreeView(frameW: number, frameH: number, tabW: number, tabH: number, zoom: number): TreeView {
  const z = clampTreeZoom(zoom);
  return {
    zoom: z,
    panX: frameW / z / 2 - tabW / 2,
    panY: frameH / z / 2 - tabH / 2,
  };
}

/** Fit the tab area in the frame, then center it. */
export function fitTreeView(frameW: number, frameH: number, tabW: number, tabH: number, padding = 0): TreeView {
  const width = Math.max(frameW - padding * 2, 1);
  const height = Math.max(frameH - padding * 2, 1);
  const zoom = clampTreeZoom(Math.min(width / Math.max(tabW, 1), height / Math.max(tabH, 1)));
  return centerTreeView(frameW, frameH, tabW, tabH, zoom);
}

/** Zoom around a viewport cursor so the tree point under it stays put (uses the map's panForZoomAt). */
export function zoomTreeAt(view: TreeView, nextZoom: number, cursor: { x: number; y: number }): TreeView {
  const zoom = clampTreeZoom(nextZoom);
  if (zoom === view.zoom) return view;
  return {
    zoom,
    panX: panForZoomAt(view.panX, cursor.x, view.zoom, zoom),
    panY: panForZoomAt(view.panY, cursor.y, view.zoom, zoom),
  };
}

/** Pan by a drag in screen pixels. */
export function panTreeByScreen(view: TreeView, dx: number, dy: number): TreeView {
  return {
    ...view,
    panX: view.panX + dx / view.zoom,
    panY: view.panY + dy / view.zoom,
  };
}

export function treeZoomPercent(zoom: number): number {
  return Math.round(clampTreeZoom(zoom) * 100);
}
