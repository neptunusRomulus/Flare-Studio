/**
 * App-wide interface (window zoom) and text (root font) scale.
 * Values are percentages; interface size steps by 10 between 75 and 200.
 */
export const INTERFACE_SCALE_MIN = 75;
export const INTERFACE_SCALE_MAX = 200;
export const INTERFACE_SCALE_STEP = 10;
export const INTERFACE_SCALE_DEFAULT = 100;

export const TEXT_SCALE_MIN = 75;
export const TEXT_SCALE_MAX = 200;
export const TEXT_SCALE_STEP = 10;
export const TEXT_SCALE_DEFAULT = 100;

export const INTERFACE_SCALE_STORAGE_KEY = 'flareStudio.interfaceScale';
export const TEXT_SCALE_STORAGE_KEY = 'flareStudio.textScale';

export type DisplayScaleSettings = { interfaceScale: number; textScale: number };
export type InterfaceScaleShortcut = 'in' | 'out' | 'reset';

export function clampScale(
  value: number,
  min = INTERFACE_SCALE_MIN,
  max = INTERFACE_SCALE_MAX,
  step = INTERFACE_SCALE_STEP,
): number {
  if (!Number.isFinite(value)) return min;
  const snapped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

export function parseScale(raw: unknown, fallback = INTERFACE_SCALE_DEFAULT): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return clampScale(Number.isFinite(n) ? n : fallback);
}

export function stepScale(current: number, direction: 1 | -1, min = INTERFACE_SCALE_MIN, max = INTERFACE_SCALE_MAX, step = INTERFACE_SCALE_STEP): number {
  return clampScale(parseScale(current) + direction * step, min, max, step);
}

/** Ctrl/Cmd + / = / Shift+= / numpad+  (in),  - / numpad- (out),  0 (reset). Alt chords are ignored. */
export function matchInterfaceScaleShortcut(event: {
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): InterfaceScaleShortcut | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const code = event.code || '';
  const key = event.key || '';
  if (code === 'Digit0' || code === 'Numpad0' || key === '0') return 'reset';
  if (code === 'Equal' || code === 'NumpadAdd' || key === '+' || key === '=') return 'in';
  if (code === 'Minus' || code === 'NumpadSubtract' || key === '-' || key === '_') return 'out';
  return null;
}

export function interfaceZoomFactor(percent: number): number {
  return parseScale(percent) / 100;
}

/** Apply text scale to the document root (Tailwind rem units follow html font-size). */
export function applyTextScaleToDocument(percent: number, root: { style: { fontSize: string } } | null = typeof document !== 'undefined' ? document.documentElement : null): void {
  if (!root) return;
  const scale = parseScale(percent, TEXT_SCALE_DEFAULT);
  root.style.fontSize = `${(16 * scale) / 100}px`;
}

export function readStoredScales(storage: Pick<Storage, 'getItem'> | null): DisplayScaleSettings {
  const read = (key: string, fallback: number) => {
    try {
      return parseScale(storage?.getItem(key), fallback);
    } catch {
      return fallback;
    }
  };
  return {
    interfaceScale: read(INTERFACE_SCALE_STORAGE_KEY, INTERFACE_SCALE_DEFAULT),
    textScale: read(TEXT_SCALE_STORAGE_KEY, TEXT_SCALE_DEFAULT),
  };
}

export function writeStoredScales(storage: Pick<Storage, 'setItem'> | null, settings: DisplayScaleSettings): void {
  if (!storage) return;
  try {
    storage.setItem(INTERFACE_SCALE_STORAGE_KEY, String(settings.interfaceScale));
    storage.setItem(TEXT_SCALE_STORAGE_KEY, String(settings.textScale));
  } catch {
    // ignore quota / private-mode errors
  }
}

/** Read localStorage and set the root font before the first paint when possible. */
export function applyStoredTextScale(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  applyTextScaleToDocument(readStoredScales(window.localStorage).textScale);
}
