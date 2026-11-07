/**
 * The saved Flare executable path (localStorage 'flarePath').
 * Play, "Change Flare Location..." and the Welcome screen installer share it.
 * Writers dispatch FLARE_PATH_EVENT so mounted hooks pick up the new value.
 */
export const FLARE_PATH_KEY = 'flarePath';
export const FLARE_PATH_EVENT = 'flare-path-changed';

export function getStoredFlarePath(): string | null {
  try {
    return localStorage.getItem(FLARE_PATH_KEY);
  } catch {
    return null;
  }
}

export function setStoredFlarePath(p: string): void {
  try {
    localStorage.setItem(FLARE_PATH_KEY, p);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FLARE_PATH_EVENT, { detail: p }));
  }
}

export type FlareVariant = 'modern' | 'classic';

/** Which one-click install a saved path points at (…/flare-studio/engines/<tag>/…). */
export function variantForFlarePath(flarePath: string | null | undefined): FlareVariant | null {
  const match = String(flarePath || '').replace(/\\/g, '/').match(/\/flare-studio\/engines\/(v[\d.]+)\//);
  if (!match) return null;
  if (match[1] === 'v1.15') return 'modern';
  if (match[1] === 'v1.14') return 'classic';
  return null;
}
