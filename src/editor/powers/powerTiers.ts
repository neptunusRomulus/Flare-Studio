/**
 * Weak / Balanced / Strong bands for power sliders. The numbers come from
 * flare-game (see scripts/power-tiers.mjs; nearest-rank p33/p66 of every
 * positive value in mods/*\/powers). Regenerate with:
 *   node scripts/power-tiers.mjs <flare-game> > src/editor/powers/powerTiers.json
 */
import tiers from './powerTiers.json';
import { durationSeconds } from './powerSummary';

export type TierLabel = 'Weak' | 'Balanced' | 'Strong';
export type TierKey = keyof typeof tiers.keys;

type Band = { p33: number; p66: number; min: number; max: number; n: number };
const BANDS = tiers.keys as Record<string, Band>;

/** Keys where a smaller number is the stronger power (short cooldown, cheap mana). */
const LOWER_IS_STRONGER = new Set(['cooldown', 'requires_mp']);

export const TIER_SOURCE = `${tiers.source} · ${tiers.method}`;

export function tierBand(key: string): Band | null {
  return BANDS[key] || null;
}

export function tierOf(key: string, value: number | null): TierLabel | null {
  const band = BANDS[key];
  if (!band || value == null || !Number.isFinite(value) || value <= 0) return null;
  let label: TierLabel = value < band.p33 ? 'Weak' : value > band.p66 ? 'Strong' : 'Balanced';
  if (LOWER_IS_STRONGER.has(key) && label !== 'Balanced') label = label === 'Weak' ? 'Strong' : 'Weak';
  return label;
}

/** Slider range: 0 to a bit past the strong band, so outliers (radius=1000) don't squash it. */
export function sliderMax(key: string, current: number | null = null): number {
  const band = BANDS[key];
  const base = band ? Math.max(band.p66 * 2.5, band.p33 * 4) : 100;
  const top = Math.max(base, current ?? 0);
  return top > 20 ? Math.ceil(top) : Math.ceil(top * 10) / 10;
}

export function sliderStep(key: string): number {
  const band = BANDS[key];
  if (!band) return 1;
  return band.p66 >= 20 ? 1 : band.p66 >= 2 ? 0.5 : 0.1;
}

/** Number shown on a slider for a raw Flare value (durations in seconds, modifier_damage as %). */
export function sliderValue(key: string, raw: string): number | null {
  if (!raw) return null;
  if (key === 'cooldown' || key === 'lifespan' || key === 'post_effect_duration') return durationSeconds(raw);
  if (key === 'modifier_damage') {
    const [mode, a] = raw.split(',');
    return mode === 'multiply' ? parseFloat(a) : null;
  }
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/** Raw Flare value for a slider number, keeping the rest of a list value (modifier_damage). */
export function rawFromSlider(key: string, value: number, previous = ''): string {
  const n = Math.round(value * 1000) / 1000;
  if (key === 'cooldown' || key === 'lifespan') return n < 1 ? `${Math.round(n * 1000)}ms` : `${n}s`;
  if (key === 'modifier_damage') {
    const parts = previous.split(',');
    return `multiply,${Math.round(n)},${parts[0] === 'multiply' && parts[2] != null ? parts[2] : '0'}`;
  }
  return String(n);
}
