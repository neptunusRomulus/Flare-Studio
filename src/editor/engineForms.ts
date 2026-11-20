/** Parse/serialize a few engine/*.txt files that have a simple repeating shape. */

export type XpRow = { level: string; xp: string };
export type HeroOption = { index: string; base: string; head: string; portrait: string; name: string };
export type HeroLayer = { direction: string; types: string };
export type LootSettings = {
  tooltip_margin: string;
  autopickup_currency: string;
  autopickup_range: string;
  currency_name: string;
  vendor_ratio_buy: string;
  vendor_ratio_sell: string;
  vendor_ratio_sell_old: string;
  sfx_loot: string;
  drop_max: string;
  drop_radius: string;
  hide_radius: string;
  vendor_ratio: string;
  vendor_ratio_buyback: string;
  extended_items_offset: string;
};

export function parseXpTable(text: string): XpRow[] {
  const rows: XpRow[] = [];
  for (const raw of String(text || '').split('\n')) {
    const m = raw.trim().match(/^level\s*=\s*([^,]+),(.*)$/);
    if (m) rows.push({ level: m[1].trim(), xp: m[2].trim() });
  }
  return rows;
}

export function serializeXpTable(rows: XpRow[], previous = ''): string {
  const header = String(previous || '')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return t.startsWith('#') || t === 'APPEND' || t === '';
    });
  const body = rows
    .filter((row) => row.level.trim())
    .map((row) => `level=${row.level.trim()},${row.xp.trim()}`);
  const lines = [...header.filter((l, i, a) => !(l.trim() === '' && i === a.length - 1)), ...body];
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

const LOOT_KEYS: Array<keyof LootSettings> = [
  'tooltip_margin', 'autopickup_currency', 'autopickup_range',
  'currency_name', 'vendor_ratio_buy', 'vendor_ratio_sell', 'vendor_ratio_sell_old',
  'sfx_loot', 'drop_max', 'drop_radius', 'hide_radius',
  'vendor_ratio', 'vendor_ratio_buyback', 'extended_items_offset',
];

export function parseLootSettings(text: string): LootSettings {
  const out: LootSettings = {
    tooltip_margin: '', autopickup_currency: '', autopickup_range: '',
    currency_name: '', vendor_ratio_buy: '', vendor_ratio_sell: '', vendor_ratio_sell_old: '',
    sfx_loot: '', drop_max: '', drop_radius: '', hide_radius: '',
    vendor_ratio: '', vendor_ratio_buyback: '', extended_items_offset: '',
  };
  for (const raw of String(text || '').split('\n')) {
    const eq = raw.trim().indexOf('=');
    if (eq <= 0) continue;
    const key = raw.trim().slice(0, eq).trim() as keyof LootSettings;
    if (LOOT_KEYS.includes(key)) out[key] = raw.trim().slice(eq + 1).trim();
  }
  return out;
}

export function upsertLootSettings(text: string, patch: Partial<LootSettings>): string {
  const next = { ...parseLootSettings(text), ...patch };
  const seen = new Set<string>();
  const rows = String(text || '').split('\n');
  const out = rows.flatMap((raw) => {
    const trimmed = raw.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return [raw];
    const key = trimmed.slice(0, eq).trim() as keyof LootSettings;
    if (!LOOT_KEYS.includes(key)) return [raw];
    seen.add(key);
    const value = String(next[key] ?? '').trim();
    if (!value) return [];
    const indent = raw.slice(0, raw.length - raw.trimStart().length);
    return [`${indent}${key}=${value}`];
  });
  const missing = LOOT_KEYS.filter((k) => !seen.has(k) && String(next[k] ?? '').trim());
  if (missing.length) {
    let insertAt = out.length;
    while (insertAt > 0 && out[insertAt - 1].trim() === '') insertAt -= 1;
    out.splice(insertAt, 0, ...missing.map((k) => `${k}=${next[k]}`));
  }
  let joined = out.join('\n');
  if (text.endsWith('\n') && !joined.endsWith('\n')) joined += '\n';
  return joined;
}

export function parseHeroOptions(text: string): HeroOption[] {
  const rows: HeroOption[] = [];
  for (const raw of String(text || '').split('\n')) {
    const m = raw.trim().match(/^option\s*=\s*(.*)$/);
    if (!m) continue;
    const [index, base, head, portrait, ...name] = m[1].split(',');
    rows.push({
      index: (index || '').trim(),
      base: (base || '').trim(),
      head: (head || '').trim(),
      portrait: (portrait || '').trim(),
      name: name.join(',').trim(),
    });
  }
  return rows;
}

export function serializeHeroOptions(rows: HeroOption[], previous = ''): string {
  const header = String(previous || '').split('\n').filter((line) => {
    const t = line.trim();
    return t.startsWith('#') || t === 'APPEND' || t === '';
  });
  const body = rows
    .filter((row) => row.index.trim() || row.name.trim())
    .map((row) => `option=${row.index},${row.base},${row.head},${row.portrait},${row.name}`);
  return `${[...header.filter((l, i, a) => !(l.trim() === '' && i === a.length - 1)), ...body].join('\n').replace(/\n+$/, '')}\n`;
}

export function parseHeroLayers(text: string): HeroLayer[] {
  const rows: HeroLayer[] = [];
  for (const raw of String(text || '').split('\n')) {
    const m = raw.trim().match(/^layer\s*=\s*([^,]+),(.*)$/);
    if (m) rows.push({ direction: m[1].trim(), types: m[2].trim() });
  }
  return rows;
}

export function serializeHeroLayers(rows: HeroLayer[], previous = ''): string {
  const header = String(previous || '').split('\n').filter((line) => {
    const t = line.trim();
    return t.startsWith('#') || t === 'APPEND' || t === '';
  });
  const body = rows
    .filter((row) => row.direction.trim())
    .map((row) => `layer=${row.direction},${row.types}`);
  return `${[...header.filter((l, i, a) => !(l.trim() === '' && i === a.length - 1)), ...body].join('\n').replace(/\n+$/, '')}\n`;
}

/** Token IDs from a comma list; actionbar treats 0 as an empty slot. */
export function listedIds(value: string, opts?: { allowZero?: boolean }): string[] {
  return String(value || '')
    .split(',')
    .map((tok) => tok.trim().split(':')[0].trim())
    .filter((id) => id && !(opts?.allowZero && id === '0'));
}

export function unknownIds(value: string, known: Set<string>, opts?: { allowZero?: boolean }): string[] {
  return listedIds(value, opts).filter((id) => !known.has(id));
}

export function collectSectionIds(files: Record<string, string>, sections: string[]): Set<string> {
  const want = new Set(sections);
  const ids = new Set<string>();
  for (const text of Object.values(files)) {
    let section = '';
    for (const raw of String(text || '').split('\n')) {
      const header = raw.trim().match(/^\[([^\]]+)\]$/);
      if (header) { section = header[1].trim(); continue; }
      if (!want.has(section)) continue;
      const m = raw.trim().match(/^id\s*=\s*(.*)$/);
      if (m && m[1].trim()) ids.add(m[1].trim());
    }
  }
  return ids;
}

export const COMBAT_PATH = 'engine/combat.txt';
export const XP_TABLE_PATH = 'engine/xp_table.txt';
export const HERO_OPTIONS_PATH = 'engine/hero_options.txt';
export const HERO_LAYERS_PATH = 'engine/hero_layers.txt';

export type CombatSettings = {
  absorb_percent: string;
  resist_percent: string;
  block_percent: string;
  avoidance_percent: string;
  miss_damage_percent: string;
  crit_damage_percent: string;
  overhit_damage_percent: string;
  resource_round_method: string;
  offscreen_enemy_encounters: string;
  poise_style: string;
};

export const COMBAT_KEYS: Array<keyof CombatSettings> = [
  'absorb_percent',
  'resist_percent',
  'block_percent',
  'avoidance_percent',
  'miss_damage_percent',
  'crit_damage_percent',
  'overhit_damage_percent',
  'resource_round_method',
  'offscreen_enemy_encounters',
  'poise_style',
];

export const COMBAT_RANGE_KEYS = [
  'absorb_percent',
  'resist_percent',
  'block_percent',
  'avoidance_percent',
  'miss_damage_percent',
  'crit_damage_percent',
  'overhit_damage_percent',
] as const;

export function emptyCombatSettings(): CombatSettings {
  return {
    absorb_percent: '',
    resist_percent: '',
    block_percent: '',
    avoidance_percent: '',
    miss_damage_percent: '',
    crit_damage_percent: '',
    overhit_damage_percent: '',
    resource_round_method: '',
    offscreen_enemy_encounters: '',
    poise_style: '',
  };
}

export function parseCombatSettings(text: string): CombatSettings {
  const out = emptyCombatSettings();
  for (const raw of String(text || '').split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim() as keyof CombatSettings;
    if (COMBAT_KEYS.includes(key)) out[key] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

/** Update known combat keys in place; keep comments and unknown keys. Empty values remove the key. */
export function upsertCombatSettings(text: string, patch: Partial<CombatSettings>): string {
  const next = { ...parseCombatSettings(text), ...patch };
  const seen = new Set<string>();
  const rows = String(text || '').split('\n');
  const out: string[] = [];
  for (const raw of rows) {
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
    const key = trimmed.slice(0, eq).trim() as keyof CombatSettings;
    if (!COMBAT_KEYS.includes(key)) {
      out.push(raw);
      continue;
    }
    seen.add(key);
    const value = String(next[key] ?? '').trim();
    if (!value) continue;
    const indent = raw.slice(0, raw.length - raw.trimStart().length);
    out.push(`${indent}${key}=${value}`);
  }
  const missing = COMBAT_KEYS.filter((key) => !seen.has(key) && String(next[key] ?? '').trim());
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
