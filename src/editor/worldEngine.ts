/** Flat engine/*.txt helpers for World Settings: comments and unknown keys are kept; empty values are omitted. */

export const GAMEPLAY_PATH = 'engine/gameplay.txt';
export const MISC_PATH = 'engine/misc.txt';
export const DEATH_PENALTY_PATH = 'engine/death_penalty.txt';
export const DEFAULT_MUSIC_PATH = 'engine/default_music.txt';
export const LOOT_PATH = 'engine/loot.txt';

export const GAMEPLAY_KEYS = ['enable_playgame'] as const;
export const DEATH_PENALTY_KEYS = ['enable', 'permadeath', 'currency', 'xp_total', 'xp_current_level', 'random_item'] as const;
export const DEFAULT_MUSIC_KEYS = ['music'] as const;
export const MISC_KEYS = [
  'save_hpmp',
  'corpse_timeout',
  'sell_without_vendor',
  'aim_assist',
  'window_title',
  'save_prefix',
  'sound_falloff',
  'party_exp_percentage',
  'enable_ally_collision',
  'enable_ally_collision_ai',
  'currency_id',
  'interact_range',
  'menus_pause',
  'save_onload',
  'save_onexit',
  'save_pos_onexit',
  'save_oncutscene',
  'save_onstash',
  'save_anywhere',
  'camera_speed',
  'save_buyback',
  'keep_buyback_on_map_change',
  'sfx_unable_to_cast',
  'combat_aborts_npc_interact',
  'fogofwar',
  'save_fogofwar',
  'mouse_move_enabled',
  'mouse_move_deadzone',
  'passive_trigger_effect_stacking',
  'fade_wall_alpha',
  'raycast_resolution',
  'min_fps',
] as const;

export function emptyKeyedValues(keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, '']));
}

export function parseKeyedValues(text: string, keys: readonly string[]): Record<string, string> {
  const allowed = new Set(keys);
  const out = emptyKeyedValues(keys);
  for (const raw of String(text || '').split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (allowed.has(key)) out[key] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

/** Update known keys in place. Empty values remove the key. Comments and unknown keys stay. */
export function upsertKeyedValues(text: string, keys: readonly string[], patch: Record<string, string>): string {
  const allowed = new Set(keys);
  const next = { ...parseKeyedValues(text, keys), ...patch };
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of String(text || '').split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      out.push(raw);
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      out.push(raw);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (!allowed.has(key)) {
      out.push(raw);
      continue;
    }
    seen.add(key);
    const value = String(next[key] ?? '').trim();
    if (!value) continue;
    const indent = raw.slice(0, raw.length - raw.trimStart().length);
    out.push(`${indent}${key}=${value}`);
  }
  const missing = keys.filter((key) => !seen.has(key) && String(next[key] ?? '').trim());
  if (missing.length) {
    let insertAt = out.length;
    while (insertAt > 0 && out[insertAt - 1].trim() === '') insertAt -= 1;
    out.splice(insertAt, 0, ...missing.map((key) => `${key}=${next[key]}`));
  }
  let joined = out.join('\n');
  if (text.endsWith('\n') && !joined.endsWith('\n')) joined += '\n';
  if (!text && joined && !joined.endsWith('\n')) joined += '\n';
  return joined;
}
