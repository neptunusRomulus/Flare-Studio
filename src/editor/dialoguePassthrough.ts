/** Helpers for Flare [dialog] keys kept in tree.passthrough so their file position survives. */
export type PassthroughTree = { passthrough?: Array<{ key: string; value: string }> };

/** Flare default: movement allowed unless allow_movement=false. */
export function allowMovementOf(tree: PassthroughTree): boolean {
  const entry = [...(tree.passthrough || [])].reverse().find((p) => p.key === 'allow_movement');
  return !entry || !/^(false|0)$/i.test(entry.value.trim());
}

export function withAllowMovement(tree: PassthroughTree, allowed: boolean): Array<{ key: string; value: string }> {
  const list = tree.passthrough || [];
  const has = list.some((p) => p.key === 'allow_movement');
  if (has) return list.map((p) => (p.key === 'allow_movement' ? { ...p, value: String(allowed) } : p));
  return allowed ? list : [...list, { key: 'allow_movement', value: 'false' }];
}

/** take_a_party: NPC joins the player's party while this dialog runs (Flare key). */
export function takePartyOf(tree: PassthroughTree): boolean {
  const entry = [...(tree.passthrough || [])].reverse().find((p) => p.key === 'take_a_party');
  return !!entry && /^(true|1)$/i.test(entry.value.trim());
}

export function withTakeParty(tree: PassthroughTree, joins: boolean): Array<{ key: string; value: string }> {
  const list = tree.passthrough || [];
  const has = list.some((p) => p.key === 'take_a_party');
  if (has) return list.map((p) => (p.key === 'take_a_party' ? { ...p, value: String(joins) } : p));
  return joins ? [...list, { key: 'take_a_party', value: 'true' }] : list;
}

function countOf(tree: PassthroughTree, key: string): { min: string; max: string } {
  const entry = [...(tree.passthrough || [])].reverse().find((p) => p.key === key);
  if (!entry) return { min: '', max: '' };
  const [min = '', max = ''] = String(entry.value).split(',');
  return { min: min.trim(), max: max.trim() };
}

function withCount(tree: PassthroughTree, key: string, min: string, max: string): Array<{ key: string; value: string }> {
  const list = tree.passthrough || [];
  const value = min.trim() ? (max.trim() ? `${min.trim()},${max.trim()}` : min.trim()) : '';
  const has = list.some((p) => p.key === key);
  if (!value) return list.filter((p) => p.key !== key);
  if (has) return list.map((p) => (p.key === key ? { ...p, value } : p));
  return [...list, { key, value }];
}

/** reward_loot_count is node-wide in Flare (first one wins); kept in passthrough so its position survives. */
export function lootCountOf(tree: PassthroughTree): { min: string; max: string } {
  return countOf(tree, 'reward_loot_count');
}

export function withLootCount(tree: PassthroughTree, min: string, max: string): Array<{ key: string; value: string }> {
  return withCount(tree, 'reward_loot_count', min, max);
}

/** loot_count is node-wide like reward_loot_count, but counts dropped loot (loot=). */
export function groundLootCountOf(tree: PassthroughTree): { min: string; max: string } {
  return countOf(tree, 'loot_count');
}

export function withGroundLootCount(tree: PassthroughTree, min: string, max: string): Array<{ key: string; value: string }> {
  return withCount(tree, 'loot_count', min, max);
}
