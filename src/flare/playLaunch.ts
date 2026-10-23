/**
 * Renderer-side copy of dataPathFromFlareSelection.
 * electron/flareLaunch.cjs is what the main process actually launches with.
 * src/flare/playLaunch.test.ts fails if the two copies drift.
 */

/** A path whose last segment contains a dot, or is exactly "flare", is a file. */
export function dataPathFromFlareSelection(flarePath: string): string {
  const normalized = String(flarePath || '').replace(/\\/g, '/').replace(/\/+$/, '');
  if (!normalized) return '';
  const base = normalized.split('/').pop() || '';
  const looksLikeFile = base.includes('.') || base === 'flare';
  if (!looksLikeFile) return normalized;
  const slash = normalized.lastIndexOf('/');
  if (slash <= 0) return normalized;
  return normalized.slice(0, slash);
}
