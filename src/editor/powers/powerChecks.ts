/**
 * Plain-language warnings for a power or effect, plus the effect chain
 * ("When it hits, apply…") that writes post_effect lines.
 */
import type { EffectKind, EffectUse, PowerKind, PowerProject, UsedBy } from './powerProject';
import { EFFECT_LINK_KEYS } from './powerProject';
import { parseSectionFile, setBlockValues } from './sectionFile';

export type Warning = { id: string; text: string; tooltip: string };

const has = (keys: Record<string, string[] | undefined>, key: string) => (keys[key] || []).some((v) => v.trim() !== '');
const first = (keys: Record<string, string[] | undefined>, key: string) => (keys[key] || [])[0] || '';

export function powerWarnings(
  power: { id: string; keys: Record<string, string[] | undefined> },
  kind: PowerKind,
  usedBy: UsedBy[],
  project: Pick<PowerProject, 'powers' | 'effects'>,
): Warning[] {
  const out: Warning[] = [];
  const keys = power.keys;
  const playerUses = usedBy.some((u) => u.kind === 'skill_tree' || u.kind === 'class' || u.kind === 'item');
  if (has(keys, 'requires_mp') && Number(first(keys, 'requires_mp')) > 0 && !playerUses) {
    out.push({ id: 'mp_unused', text: 'Has a mana cost but no player can use it', tooltip: 'requires_mp is set, but no skill tree, class or item gives this power to the player. Monsters and traps ignore mana.' });
  }
  if (usedBy.length === 0) {
    out.push({ id: 'unused', text: `This ${kind === 'monster' ? 'Monster Attack' : kind === 'item' ? 'Item Use' : kind === 'trap' ? 'Trap' : 'Skill'} is never used`, tooltip: 'No enemy, item, event, NPC, skill tree, class or other power refers to this id.' });
  }
  const type = first(keys, 'type');
  if (!type) out.push({ id: 'no_type', text: 'Pick how it works (missile, area, spawn…)', tooltip: 'type is missing; Flare needs fixed, missile, repeater, spawn, transform or block.' });
  if (type === 'missile' && !has(keys, 'speed')) out.push({ id: 'missile_speed', text: 'Missile has no speed, it will not move', tooltip: 'type=missile without speed=' });
  if (type === 'spawn' && !has(keys, 'spawn_type')) out.push({ id: 'spawn_type', text: 'Summon has nothing to spawn', tooltip: 'type=spawn without spawn_type=' });
  if (has(keys, 'use_hazard') && first(keys, 'use_hazard') === 'true' && !has(keys, 'base_damage') && !has(keys, 'post_effect')) {
    out.push({ id: 'hazard_noop', text: 'Hits, but does no damage and applies nothing', tooltip: 'use_hazard=true without base_damage or post_effect' });
  }
  const effectIds = new Set(project.effects.map((e) => e.id));
  for (const key of EFFECT_LINK_KEYS) {
    for (const value of keys[key] || []) {
      const id = value.split(',')[0].trim();
      if (id && !effectIds.has(id)) out.push({ id: `missing_effect_${id}`, text: `Applies "${id}", which does not exist`, tooltip: `${key}=${value}: no [effect] id=${id} in powers/effects.txt` });
    }
  }
  const powerIds = new Set(project.powers.map((p) => p.id));
  for (const key of ['pre_power', 'post_power', 'wall_power', 'expire_power']) {
    const id = first(keys, key).split(',')[0].trim();
    if (id && !powerIds.has(id)) out.push({ id: `missing_power_${key}`, text: `Triggers power ${id}, which does not exist`, tooltip: `${key}=${first(keys, key)}` });
  }
  return out;
}

export function effectWarnings(effect: { id: string; keys: Record<string, string[] | undefined> }, kind: EffectKind, uses: EffectUse[]): Warning[] {
  const out: Warning[] = [];
  if (uses.length === 0) out.push({ id: 'unused', text: `This ${kind === 'buff' ? 'Buff' : 'Debuff'} is never used`, tooltip: 'No power applies it with post_effect / post_effect_src, and no item or enemy lists it.' });
  if (!has(effect.keys, 'type')) out.push({ id: 'no_type', text: 'Pick what it changes (speed, damage, shield…)', tooltip: 'type is missing in [effect]' });
  return out;
}

/** Warnings shown in the delete confirm: what breaks if this goes. */
export function deleteImpact(usedBy: UsedBy[]): string {
  if (usedBy.length === 0) return 'Nothing uses it.';
  const names = usedBy.slice(0, 3).map((u) => u.name);
  const more = usedBy.length > 3 ? ` and ${usedBy.length - 3} more` : '';
  return `Used by ${names.join(', ')}${more}; they will stop working.`;
}

export type ChainLink = { key: string; index: number; effectId: string; magnitude: string; duration: string; chance: string };

export function readChain(keys: Record<string, string[] | undefined>): ChainLink[] {
  const out: ChainLink[] = [];
  for (const key of EFFECT_LINK_KEYS) {
    (keys[key] || []).forEach((value, index) => {
      const [effectId = '', magnitude = '0', duration = '0', chance = ''] = value.split(',').map((p) => p.trim());
      if (effectId) out.push({ key, index, effectId, magnitude, duration, chance });
    });
  }
  return out;
}

export function chainValue(link: Pick<ChainLink, 'effectId' | 'magnitude' | 'duration' | 'chance'>): string {
  return [link.effectId, link.magnitude || '0', link.duration || '0', ...(link.chance ? [link.chance] : [])].join(',');
}

function currentValues(text: string, blockIndex: number, key: string): string[] {
  const block = parseSectionFile(text, 'power').blocks[blockIndex];
  return block ? block.entries.filter((e) => e.key === key).map((e) => e.value) : [];
}

/** "When it hits, apply…": add one post_effect (on target) or post_effect_src (on caster). */
export function addChainLink(text: string, blockIndex: number, link: Omit<ChainLink, 'key' | 'index'>, onCaster = false): string {
  const key = onCaster ? 'post_effect_src' : 'post_effect';
  return setBlockValues(text, 'power', blockIndex, key, [...currentValues(text, blockIndex, key), chainValue(link)]);
}

export function updateChainLink(text: string, blockIndex: number, key: string, index: number, link: Omit<ChainLink, 'key' | 'index'>): string {
  const values = currentValues(text, blockIndex, key);
  if (index < 0 || index >= values.length) return text;
  values[index] = chainValue(link);
  return setBlockValues(text, 'power', blockIndex, key, values);
}

export function removeChainLink(text: string, blockIndex: number, key: string, index: number): string {
  const values = currentValues(text, blockIndex, key);
  if (index < 0 || index >= values.length) return text;
  values.splice(index, 1);
  return setBlockValues(text, 'power', blockIndex, key, values);
}

/** Next free numeric power id (Flare power ids are numbers). */
export function nextPowerId(project: Pick<PowerProject, 'powers'>): string {
  const max = project.powers.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
  return String(max + 1);
}

/** Unique effect id based on a template id. */
export function uniqueEffectId(base: string, project: Pick<PowerProject, 'effects'>): string {
  const ids = new Set(project.effects.map((e) => e.id));
  if (!ids.has(base)) return base;
  let n = 2;
  while (ids.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}
