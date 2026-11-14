/**
 * Behavior cards for the enemy window. Picking a card fills the AI numbers;
 * fine-tuning still happens under More. wander_radius is a map-spawn key in
 * Flare 1.15, but Wanders still sets it on the object so a later map spawn
 * can use it.
 */

export type BehaviorPresetId = 'guard' | 'wanders' | 'aggressive' | 'coward';

export type CombatStyle = 'default' | 'aggressive' | 'passive';

export type BehaviorValues = {
  combatStyle: CombatStyle;
  isStationary: boolean;
  threatRange: string;
  fleeRange: string;
  fleeDuration: string;
  fleeCooldown: string;
  chancePursue: string;
  chanceFlee: string;
  wanderRadius: string;
};

export const BEHAVIOR_PRESET_IDS: BehaviorPresetId[] = ['guard', 'wanders', 'aggressive', 'coward'];

export const BEHAVIOR_PRESETS: Record<BehaviorPresetId, BehaviorValues> = {
  guard: {
    combatStyle: 'default',
    isStationary: true,
    threatRange: '5',
    fleeRange: '',
    fleeDuration: '',
    fleeCooldown: '',
    chancePursue: '0',
    chanceFlee: '0',
    wanderRadius: '',
  },
  wanders: {
    combatStyle: 'default',
    isStationary: false,
    threatRange: '8',
    fleeRange: '',
    fleeDuration: '',
    fleeCooldown: '',
    chancePursue: '50',
    chanceFlee: '0',
    wanderRadius: '4',
  },
  aggressive: {
    combatStyle: 'aggressive',
    isStationary: false,
    threatRange: '16',
    fleeRange: '',
    fleeDuration: '',
    fleeCooldown: '',
    chancePursue: '100',
    chanceFlee: '0',
    wanderRadius: '',
  },
  coward: {
    combatStyle: 'default',
    isStationary: false,
    threatRange: '8',
    fleeRange: '6',
    fleeDuration: '3s',
    fleeCooldown: '5s',
    chancePursue: '25',
    chanceFlee: '80',
    wanderRadius: '',
  },
};

export const BEHAVIOR_PRESET_META: Record<BehaviorPresetId, { label: string; hint: string }> = {
  guard: { label: 'Guard', hint: 'Stands still' },
  wanders: { label: 'Wanders', hint: 'Walks nearby' },
  aggressive: { label: 'Aggressive', hint: 'Attacks from far away' },
  coward: { label: 'Coward', hint: 'Flees when close' },
};

export function valuesFromBehaviorPreset(id: BehaviorPresetId): BehaviorValues {
  return { ...BEHAVIOR_PRESETS[id] };
}

const same = (a: string, b: string) => String(a || '').trim() === String(b || '').trim();

/** Exact match against the numbers a card writes. */
export function behaviorPresetFromValues(values: BehaviorValues): BehaviorPresetId | null {
  for (const id of BEHAVIOR_PRESET_IDS) {
    const preset = BEHAVIOR_PRESETS[id];
    if (
      values.combatStyle === preset.combatStyle
      && values.isStationary === preset.isStationary
      && same(values.threatRange, preset.threatRange)
      && same(values.fleeRange, preset.fleeRange)
      && same(values.fleeDuration, preset.fleeDuration)
      && same(values.fleeCooldown, preset.fleeCooldown)
      && same(values.chancePursue, preset.chancePursue)
      && same(values.chanceFlee, preset.chanceFlee)
      && same(values.wanderRadius, preset.wanderRadius)
    ) {
      return id;
    }
  }
  return null;
}
