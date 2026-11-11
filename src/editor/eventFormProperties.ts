/** Event form fields. Keys the form does not own must survive a save. */

import { EVENT_EXTRA_KEYS } from './eventExtraProperties';

export type EventPropertyValue = string | string[];

export const EVENT_FORM_KEYS = new Set([
  'activate',
  'location',
  'hotspot',
  'cooldown',
  'delay',
  'requires_status',
  'requires_level',
  'requires_item',
  'requires_not_item',
  'requires_currency',
  'msg',
  'reward_xp',
  'reward_currency',
  'remove_currency',
  'reward_item',
  'remove_item',
  'loot',
  'reward_loot',
  'reward_loot_count',
  'spawn',
  'intermap',
  'soundfx',
  'chance_exec',
  'save_game',
  'script',
  '_description',
  'power',
  'power_path',
  'power_damage',
  'power_stats',
  'power_level',
  'mapmod',
  'mapmod_toggle',
  'requires_tile',
  'requires_not_tile',
  'spawn_level',
  'intermap_id',
  'procgen_filename',
  'procgen_link',
  'procgen_door_level',
  'restore',
  'npc',
  'music',
  'book',
  'respec',
  'show_on_minimap',
  'parallax_layers',
  'random_status',
  ...EVENT_EXTRA_KEYS,
]);

export function mergeEventFormProperties(
  existing: Record<string, EventPropertyValue | undefined> | null | undefined,
  formProps: Record<string, EventPropertyValue>,
): Record<string, EventPropertyValue> {
  const next: Record<string, EventPropertyValue> = {};
  for (const [key, value] of Object.entries(existing || {})) {
    if (value == null || EVENT_FORM_KEYS.has(key)) continue;
    next[key] = value;
  }
  for (const [key, value] of Object.entries(formProps)) {
    next[key] = value;
  }
  return next;
}
