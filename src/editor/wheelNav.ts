/**
 * Classify a wheel event:
 * - 'pinch': ctrlKey set (Chromium/Electron sends touchpad pinch as ctrl+wheel; also Ctrl+mouse wheel) -> smooth zoom
 * - 'pan':   touchpad two-finger scroll: pixel mode with a horizontal component, or small / fractional deltas
 * - 'step':  ordinary mouse wheel notch (line/page mode, or whole-pixel delta >= 50) -> old 10% zoom step
 */
export type WheelKind = 'pinch' | 'pan' | 'step';

export function classifyWheel(e: { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean }): WheelKind {
  if (e.ctrlKey) return 'pinch';
  if (e.deltaMode !== 0) return 'step';
  if (e.deltaX !== 0) return 'pan';
  const ay = Math.abs(e.deltaY);
  if (!Number.isInteger(e.deltaY) || ay < 50) return 'pan';
  return 'step';
}

/** Zoom factor for a pinch delta (negative deltaY = fingers apart = zoom in). */
export function pinchFactor(deltaY: number): number {
  const d = Math.max(-50, Math.min(50, deltaY));
  return Math.exp(-d * 0.01);
}

/** New pan keeping the world point under the cursor fixed. screen = (world + W/2 + pan) * zoom. */
export function panForZoomAt(pan: number, cursor: number, oldZoom: number, newZoom: number): number {
  return pan + cursor / newZoom - cursor / oldZoom;
}
