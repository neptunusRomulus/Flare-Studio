export const PALETTE_PANEL_DEFAULT = 380;
export const PALETTE_PANEL_MIN = 260;
export const PALETTE_PANEL_MAX = 900;
export const PALETTE_PANEL_KEY = 'flare.paletteDockWidth';

export const DRAWING_LAYER_TYPES = ['background', 'collision', 'object'];
export function isDrawingLayer(type: string | null | undefined): boolean {
  return !!type && DRAWING_LAYER_TYPES.includes(type);
}

/** Clamp panel width; never wider than 60% of the window. */
export function clampPanelWidth(w: number, windowWidth: number): number {
  const max = Math.max(PALETTE_PANEL_MIN, Math.min(PALETTE_PANEL_MAX, Math.floor(windowWidth * 0.6)));
  if (!Number.isFinite(w)) return PALETTE_PANEL_DEFAULT;
  return Math.round(Math.max(PALETTE_PANEL_MIN, Math.min(max, w)));
}

/** Zoom that fits the image width into the viewport (minus padding), clamped. */
export function fitZoom(viewportWidth: number, imageWidth: number, min = 0.25, max = 4, padding = 16): number {
  if (imageWidth <= 0 || viewportWidth <= padding) return 1;
  const z = (viewportWidth - padding) / imageWidth;
  return Math.max(min, Math.min(max, Math.floor(z * 100) / 100));
}

/** Client point -> image pixel, for a canvas drawn at any CSS scale. */
export function clientToImage(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, canvasW: number, canvasH: number): { x: number; y: number } {
  return { x: (clientX - rect.left) * (canvasW / rect.width), y: (clientY - rect.top) * (canvasH / rect.height) };
}
