/**
 * Studio names for Flare powers, effects and campaign statuses.
 * Powers are named by where they are used; effects by what they do.
 */
import type { EffectKind, EffectUse, PowerEntry, PowerKind, PowerProject, UsedBy } from './powerProject';

export type ContentKind = PowerKind | EffectKind | 'flag';

export type KindMeta = {
  label: string;
  plural: string;
  /** lucide-react icon name */
  icon: 'Wand2' | 'Skull' | 'FlaskConical' | 'Flame' | 'ArrowUpCircle' | 'ArrowDownCircle' | 'Flag';
  /** Tailwind text color class */
  color: string;
  tooltip: string;
};

export const KIND_META: Record<ContentKind, KindMeta> = {
  skill: { label: 'Skill', plural: 'Skills', icon: 'Wand2', color: 'text-blue-500', tooltip: 'Flare [power] the player can use (powers menu, hotbar, class)' },
  monster: { label: 'Monster Attack', plural: 'Monster Attacks', icon: 'Skull', color: 'text-red-500', tooltip: 'Flare [power] used by an enemy (power=, passive_powers=)' },
  item: { label: 'Item Use', plural: 'Item Uses', icon: 'FlaskConical', color: 'text-green-500', tooltip: 'Flare [power] an item casts (item power=)' },
  trap: { label: 'Trap / Map Spell', plural: 'Traps / Map Spells', icon: 'Flame', color: 'text-orange-500', tooltip: 'Flare [power] cast by a map event or NPC (event power=)' },
  buff: { label: 'Buff', plural: 'Buffs', icon: 'ArrowUpCircle', color: 'text-emerald-500', tooltip: 'Flare [effect] that helps its target' },
  debuff: { label: 'Debuff', plural: 'Debuffs', icon: 'ArrowDownCircle', color: 'text-purple-500', tooltip: 'Flare [effect] that hurts its target' },
  flag: { label: 'Story Flag', plural: 'Story Flags', icon: 'Flag', color: 'text-amber-500', tooltip: 'Flare campaign status (set_status / requires_status)' },
};

export const POWER_KIND_ORDER: PowerKind[] = ['skill', 'monster', 'item', 'trap'];

const isItemName = (name?: string) => /\b(potion|elixir|scroll)\b/i.test(name || '');

/** Category from the file a power lives in (flare-game keeps enemy/item/environment powers in their own files). */
function kindFromPath(path: string): PowerKind | null {
  const name = path.toLowerCase();
  if (/enemy|enemies|monster/.test(name)) return 'monster';
  if (/item|potion|scroll/.test(name)) return 'item';
  if (/environment|trap|map/.test(name)) return 'trap';
  return null;
}

/**
 * Where is the power used? Skill trees win, then items, then classes, then enemies, then
 * map events/NPCs. No references: the kind the user picked, then the file name, then Skill.
 */
export function categorizePower(power: Pick<PowerEntry, 'path'> & { name?: string }, usedBy: UsedBy[] = [], picked?: PowerKind | null): PowerKind {
  const kinds = new Set(usedBy.map((use) => use.kind));
  if (kinds.has('skill_tree')) return 'skill';
  // Classes often put potions on the starting action bar; the item is the better name then.
  if (kinds.has('item')) return 'item';
  if (kinds.has('class')) {
    // Only on a starting action bar (not class powers=): potions live there too.
    const onlyActionbar = usedBy.every((use) => use.kind !== 'class' || use.key === 'actionbar');
    if (onlyActionbar && (isItemName(power.name) || kindFromPath(power.path) === 'item')) return 'item';
    return 'skill';
  }
  if (kinds.has('enemy')) return 'monster';
  if (kinds.has('event') || kinds.has('npc')) return 'trap';
  if (picked) return picked;
  if (isItemName(power.name)) return 'item';
  return kindFromPath(power.path) || 'skill';
}

const DEBUFF_TYPES = new Set(['damage', 'damage_percent', 'stun', 'knockback']);
const BUFF_TYPES = new Set([
  'heal', 'hpot', 'hpot_percent', 'mpot', 'mpot_percent', 'shield', 'revive', 'convert', 'immunity',
  'immunity_damage', 'immunity_slow', 'immunity_stun', 'immunity_hp_steal', 'immunity_mp_steal',
  'immunity_knockback', 'immunity_damage_reflect', 'immunity_stat_debuff', 'resist_all', 'death_sentence',
  'reflect_chance', 'return_damage', 'stealth',
]);

function magnitudeNumber(value: string): number | null {
  const n = parseFloat(String(value || '').replace('%', ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Buff or Debuff from the effect type, then from how powers apply it:
 * speed/attack_speed below 100 slow the target; negative stat bonuses hurt.
 */
export function classifyEffect(effect: Pick<PowerEntry, 'id' | 'name' | 'keys'>, uses: EffectUse[] = []): EffectKind {
  const type = (effect.keys.type?.[0] || effect.id).trim();
  if (type === 'death_sentence') return 'debuff';
  if (DEBUFF_TYPES.has(type)) return 'debuff';
  if (BUFF_TYPES.has(type)) return 'buff';
  const magnitudes = uses.map((use) => magnitudeNumber(use.magnitude)).filter((n): n is number => n != null);
  if (type === 'speed' || type === 'attack_speed') {
    if (magnitudes.length) return magnitudes.some((n) => n < 100) ? 'debuff' : 'buff';
    return /slow|freeze|chill|snare/i.test(`${effect.id} ${effect.name}`) ? 'debuff' : 'buff';
  }
  if (magnitudes.some((n) => n < 0)) return 'debuff';
  if (/poison|bleed|burn|slow|stun|curse|weak|blind|fear/i.test(`${effect.id} ${effect.name}`)) return 'debuff';
  return 'buff';
}

/**
 * Kind for every power in the project. A power only triggered by other powers
 * (post_power, wall_power, …) takes the kind of the power that triggers it.
 */
export function resolvePowerKinds(
  project: Pick<PowerProject, 'powers' | 'powerUsedBy'>,
  picked: Record<string, PowerKind> = {},
): Record<string, PowerKind> {
  const byId = new Map(project.powers.map((p) => [p.id, p]));
  const out: Record<string, PowerKind> = {};
  const resolve = (id: string, seen: Set<string>): PowerKind => {
    if (out[id]) return out[id];
    const power = byId.get(id);
    const usedBy = project.powerUsedBy[id] || [];
    const direct = usedBy.filter((u) => u.kind !== 'power');
    let kind: PowerKind;
    if (direct.length || picked[id] || !usedBy.length || !power) {
      kind = categorizePower(power || { path: '' }, direct, picked[id]);
    } else {
      seen.add(id);
      const parents = project.powers.filter((p) => !seen.has(p.id) && usedBy.some((u) => u.path === p.path && u.name === p.name));
      kind = parents.length ? resolve(parents[0].id, seen) : categorizePower(power, [], null);
    }
    out[id] = kind;
    return kind;
  };
  for (const p of project.powers) resolve(p.id, new Set());
  return out;
}
