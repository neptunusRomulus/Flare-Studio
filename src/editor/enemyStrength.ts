/**
 * Weak / Balanced / Strong starting values for the enemy header slider.
 * These are Studio conveniences, not engine defaults. Moving the slider
 * writes HP, melee (and ranged, if asked) damage, absorb, XP, and the
 * Studio-only attack/defense properties. Other stats are left alone.
 */

export type StrengthTier = 'weak' | 'balanced' | 'strong';

export type StrengthStats = {
  hp: string;
  attack: string;
  defense: string;
  xp: string;
  dmgMeleeMin: string;
  dmgMeleeMax: string;
  absorbMin: string;
  absorbMax: string;
};

export const STRENGTH_TIERS: StrengthTier[] = ['weak', 'balanced', 'strong'];

/** HP, attack (mid-range damage), defense (absorb), XP for each stop. */
export const STRENGTH_STATS: Record<StrengthTier, StrengthStats> = {
  weak: {
    hp: '20',
    attack: '3',
    defense: '0',
    xp: '8',
    dmgMeleeMin: '2',
    dmgMeleeMax: '4',
    absorbMin: '0',
    absorbMax: '0',
  },
  balanced: {
    hp: '80',
    attack: '10',
    defense: '2',
    xp: '30',
    dmgMeleeMin: '8',
    dmgMeleeMax: '12',
    absorbMin: '1',
    absorbMax: '2',
  },
  strong: {
    hp: '200',
    attack: '20',
    defense: '8',
    xp: '80',
    dmgMeleeMin: '16',
    dmgMeleeMax: '24',
    absorbMin: '4',
    absorbMax: '8',
  },
};

export function statsFromStrength(tier: StrengthTier): StrengthStats {
  return { ...STRENGTH_STATS[tier] };
}

const norm = (value: string | number | null | undefined) => String(value ?? '').trim();

/** Returns the matching tier only when HP, XP, attack and defense all match. */
export function strengthFromStats(stats: Partial<StrengthStats>): StrengthTier | null {
  for (const tier of STRENGTH_TIERS) {
    const expected = STRENGTH_STATS[tier];
    if (norm(stats.hp) !== expected.hp) continue;
    if (norm(stats.xp) !== expected.xp) continue;
    const atk = norm(stats.dmgMeleeMax) || norm(stats.attack);
    if (atk !== expected.dmgMeleeMax && atk !== expected.attack) continue;
    const def = norm(stats.absorbMax) || norm(stats.defense);
    if (def !== expected.absorbMax && def !== expected.defense) continue;
    return tier;
  }
  return null;
}

export function strengthLabel(tier: StrengthTier): string {
  return tier === 'weak' ? 'Weak' : tier === 'strong' ? 'Strong' : 'Balanced';
}
