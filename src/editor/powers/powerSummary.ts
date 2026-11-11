/**
 * One plain sentence that says what a power does, e.g.
 * "Costs 10 mana, fires a missile, deals 150% damage, applies Burning (3s), usable every 2s."
 */

export type KeyValues = Record<string, string[] | undefined>;
export type EffectNames = Record<string, string>;

const first = (keys: KeyValues, key: string) => (keys[key]?.[0] ?? '').trim();
const num = (value: string) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};
const trimNum = (n: number) => String(Math.round(n * 100) / 100);

/** Flare duration ("500ms", "2s", "1.5s", bare number = ms) → seconds, or null. */
export function durationSeconds(value: string): number | null {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  const m = v.match(/^(-?[\d.]+)\s*(ms|s)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] === 's' ? n : n / 1000;
}

export function formatSeconds(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${trimNum(seconds)}s`;
}

function damageText(keys: KeyValues): string {
  const modifier = first(keys, 'modifier_damage');
  if (modifier) {
    const [mode, a, b] = modifier.split(',').map((part) => part.trim());
    if (mode === 'multiply' && a) return `deals ${a}% damage`;
    if (mode === 'add' && a) return `deals +${a}${b && b !== a && b !== '0' ? `–${b}` : ''} damage`;
    if (mode === 'absolute' && a) return `deals ${a}${b && b !== a && b !== '0' ? `–${b}` : ''} damage`;
  }
  const base = first(keys, 'base_damage');
  if (base && base !== 'none') return 'deals damage';
  return '';
}

function actionText(keys: KeyValues): string {
  const type = first(keys, 'type');
  const count = num(first(keys, 'count'));
  const many = count && count > 1 ? count : null;
  const pos = first(keys, 'starting_pos');
  const buff = first(keys, 'buff') === 'true';
  switch (type) {
    case 'missile':
      return many ? `fires ${many} missiles` : 'fires a missile';
    case 'repeater':
      return many ? `strikes ${many} times in a row` : 'strikes in a row';
    case 'spawn': {
      const what = first(keys, 'spawn_type');
      return `summons ${many ? `${many} ` : ''}${what ? what.replace(/_/g, ' ') : 'a creature'}`;
    }
    case 'transform': {
      const d = durationSeconds(first(keys, 'transform_duration'));
      return `transforms the hero${d ? ` for ${formatSeconds(d)}` : ''}`;
    }
    case 'block':
      return 'blocks attacks';
    default:
      if (buff) return 'affects the caster';
      if (pos === 'melee') return 'strikes in melee';
      if (pos === 'target') return 'hits the target spot';
      return 'takes effect around the caster';
  }
}

function effectText(keys: KeyValues, names: EffectNames): string[] {
  const out: string[] = [];
  for (const value of keys.post_effect || []) {
    const [id, magnitude = '', duration = ''] = value.split(',').map((part) => part.trim());
    if (!id) continue;
    const name = names[id] || id.replace(/_/g, ' ');
    const d = durationSeconds(duration);
    const m = magnitude && magnitude !== '0' ? ` ${magnitude}` : '';
    out.push(`applies ${name}${m}${d ? ` for ${formatSeconds(d)}` : ''}`);
  }
  return out;
}

export function summarizePower(keys: KeyValues, effectNames: EffectNames = {}): string {
  const parts: string[] = [];
  const mp = num(first(keys, 'requires_mp'));
  const hp = num(first(keys, 'requires_hp'));
  if (mp && mp > 0) parts.push(`costs ${trimNum(mp)} mana`);
  if (hp && hp > 0) parts.push(`costs ${trimNum(hp)} HP`);
  if (first(keys, 'passive') === 'true') parts.push('always on');
  let action = actionText(keys);
  const range = num(first(keys, 'target_range'));
  if (range && range > 0) action += ` up to ${trimNum(range)} tiles away`;
  const radius = num(first(keys, 'radius'));
  if (radius && radius > 0 && first(keys, 'type') !== 'missile') action += ` (${trimNum(radius)} tile radius)`;
  parts.push(action);
  const damage = damageText(keys);
  if (damage) parts.push(damage);
  parts.push(...effectText(keys, effectNames));
  const cooldown = durationSeconds(first(keys, 'cooldown'));
  if (cooldown && cooldown > 0) parts.push(`usable every ${formatSeconds(cooldown)}`);
  const sentence = parts.join(', ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

export function summarizeEffect(keys: KeyValues, kindLabel: string): string {
  const type = first(keys, 'type').replace(/_/g, ' ');
  const stack = first(keys, 'can_stack') === 'true' ? 'stacks' : first(keys, 'can_stack') === 'false' ? 'does not stack' : '';
  const max = num(first(keys, 'max_stacks'));
  const parts = [`${kindLabel}${type ? `: ${type}` : ''}`];
  if (stack) parts.push(max && max > 0 ? `${stack} up to ${trimNum(max)}` : stack);
  return `${parts.join(', ')}.`;
}
