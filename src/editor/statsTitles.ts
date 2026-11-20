/** Parsers for Flare engine/primary_stats.txt, engine/titles.txt, engine/stats.txt, engine/resource_stats.txt, and engine/damage_types.txt. */

export const PRIMARY_STATS_PATH = 'engine/primary_stats.txt';
export const TITLES_PATH = 'engine/titles.txt';
export const HERO_STATS_PATH = 'engine/stats.txt';
export const RESOURCE_STATS_PATH = 'engine/resource_stats.txt';
export const DAMAGE_TYPES_PATH = 'engine/damage_types.txt';

export type StatCategory = 'core' | 'offense' | 'defense' | 'misc' | 'resist' | 'damage' | 'resource';

export type CoreStatDef = {
  key: string;
  name: string;
  category: StatCategory;
  percent: boolean;
};

/** Hardcoded in flare-engine/src/Stats.h / Stats.cpp. Mods cannot add new keys to this list. */
export const CORE_STATS: CoreStatDef[] = [
  { key: 'hp', name: 'Max HP', category: 'core', percent: false },
  { key: 'hp_regen', name: 'HP Regen', category: 'core', percent: false },
  { key: 'mp', name: 'Max MP', category: 'core', percent: false },
  { key: 'mp_regen', name: 'MP Regen', category: 'core', percent: false },
  { key: 'accuracy', name: 'Accuracy', category: 'offense', percent: true },
  { key: 'avoidance', name: 'Avoidance', category: 'defense', percent: true },
  { key: 'absorb_min', name: 'Absorb (Min.)', category: 'defense', percent: false },
  { key: 'absorb_max', name: 'Absorb (Max.)', category: 'defense', percent: false },
  { key: 'crit', name: 'Critical Hit Chance', category: 'offense', percent: true },
  { key: 'xp_gain', name: 'Bonus XP', category: 'misc', percent: true },
  { key: 'currency_find', name: 'Bonus Currency', category: 'misc', percent: true },
  { key: 'item_find', name: 'Item Find Chance', category: 'misc', percent: true },
  { key: 'stealth', name: 'Stealth', category: 'defense', percent: true },
  { key: 'poise', name: 'Poise', category: 'defense', percent: true },
  { key: 'reflect_chance', name: 'Missile Reflect Chance', category: 'defense', percent: true },
  { key: 'return_damage', name: 'Damage Reflection', category: 'offense', percent: true },
  { key: 'hp_steal', name: 'HP Steal', category: 'offense', percent: true },
  { key: 'mp_steal', name: 'MP Steal', category: 'offense', percent: true },
  { key: 'resist_damage_over_time', name: 'Resist Damage-Over-Time', category: 'resist', percent: true },
  { key: 'resist_slow', name: 'Resist Slow', category: 'resist', percent: true },
  { key: 'resist_stun', name: 'Resist Stun', category: 'resist', percent: true },
  { key: 'resist_knockback', name: 'Resist Knockback', category: 'resist', percent: true },
  { key: 'resist_stat_debuff', name: 'Resist Stat Debuffs', category: 'resist', percent: true },
  { key: 'resist_damage_reflect', name: 'Resist Damage Reflection', category: 'resist', percent: true },
  { key: 'resist_hp_steal', name: 'Resist HP Steal', category: 'resist', percent: true },
  { key: 'resist_mp_steal', name: 'Resist MP Steal', category: 'resist', percent: true },
];

export const CORE_STAT_KEYS = new Set(CORE_STATS.map((stat) => stat.key));

export const DEFAULT_PRIMARY_STATS: PrimaryStat[] = [
  { id: 'physical', name: 'Physical' },
  { id: 'mental', name: 'Mental' },
  { id: 'offense', name: 'Offense' },
  { id: 'defense', name: 'Defense' },
];

export type PrimaryStat = { id: string; name: string };

export type TitleEntry = {
  title: string;
  level: string;
  power: string;
  requires_status: string;
  requires_not_status: string;
  primary_stat_1: string;
  primary_stat_2: string;
};

export type HeroStatsScalars = {
  stat_points_per_level: string;
  max_points_per_stat: string;
  power_points_per_level: string;
  levelup_restore_hp: string;
  levelup_restore_mp: string;
  speed: string;
  sfx_step: string;
  cooldown: string;
  cooldown_hit: string;
  categories: string;
};

export const HERO_STAT_SCALAR_KEYS: Array<keyof HeroStatsScalars> = [
  'stat_points_per_level',
  'max_points_per_stat',
  'power_points_per_level',
  'levelup_restore_hp',
  'levelup_restore_mp',
  'speed',
  'sfx_step',
  'cooldown',
  'cooldown_hit',
  'categories',
];

export const HERO_STATS_ENGINE_DEFAULTS: HeroStatsScalars = {
  stat_points_per_level: '1',
  max_points_per_stat: '',
  power_points_per_level: '1',
  levelup_restore_hp: 'true',
  levelup_restore_mp: 'true',
  speed: '',
  sfx_step: '',
  cooldown: '',
  cooldown_hit: '',
  categories: '',
};

export type PerPrimaryBonus = { primary: string; stat: string; value: string };

export type HeroStatsFile = {
  scalars: HeroStatsScalars;
  base: Record<string, string>;
  perLevel: Record<string, string>;
  perPrimary: PerPrimaryBonus[];
  unknownLines: string[];
  trailing: string;
};

export type ResourceStat = {
  stat_base: string;
  stat_regen: string;
  stat_steal: string;
  stat_resist_steal: string;
  stat_heal: string;
  stat_heal_percent: string;
  menu_filename: string;
  text_base: string;
  text_base_desc: string;
  text_regen: string;
  text_regen_desc: string;
  text_steal: string;
  text_steal_desc: string;
  text_resist_steal: string;
  text_resist_steal_desc: string;
  text_combat_heal: string;
  text_log_restore: string;
  text_log_low: string;
  text_tooltip_heal: string;
  text_tooltip_cost: string;
  levelup_restore: string;
};

export const RESOURCE_STAT_KEYS: Array<keyof ResourceStat> = [
  'stat_base',
  'stat_regen',
  'stat_steal',
  'stat_resist_steal',
  'stat_heal',
  'stat_heal_percent',
  'menu_filename',
  'text_base',
  'text_base_desc',
  'text_regen',
  'text_regen_desc',
  'text_steal',
  'text_steal_desc',
  'text_resist_steal',
  'text_resist_steal_desc',
  'text_combat_heal',
  'text_log_restore',
  'text_log_low',
  'text_tooltip_heal',
  'text_tooltip_cost',
  'levelup_restore',
];

export type DamageType = {
  id: string;
  name: string;
  min: string;
  max: string;
  resist: string;
  elemental: string;
};

export function emptyResourceStat(): ResourceStat {
  return {
    stat_base: '',
    stat_regen: '',
    stat_steal: '',
    stat_resist_steal: '',
    stat_heal: '',
    stat_heal_percent: '',
    menu_filename: '',
    text_base: '',
    text_base_desc: '',
    text_regen: '',
    text_regen_desc: '',
    text_steal: '',
    text_steal_desc: '',
    text_resist_steal: '',
    text_resist_steal_desc: '',
    text_combat_heal: '',
    text_log_restore: '',
    text_log_low: '',
    text_tooltip_heal: '',
    text_tooltip_cost: '',
    levelup_restore: 'true',
  };
}

export function emptyTitle(): TitleEntry {
  return {
    title: '',
    level: '',
    power: '',
    requires_status: '',
    requires_not_status: '',
    primary_stat_1: '',
    primary_stat_2: '',
  };
}

export function emptyHeroStats(): HeroStatsFile {
  return {
    scalars: { ...HERO_STATS_ENGINE_DEFAULTS },
    base: {},
    perLevel: {},
    perPrimary: [],
    unknownLines: [],
    trailing: '',
  };
}

export function normalizeStatId(raw: string): string | null {
  const id = raw.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!id || !/^[a-z][a-z0-9_]*$/.test(id)) return null;
  return id;
}

function isAppendFile(text: string): boolean {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    return line === 'APPEND';
  }
  return false;
}

export function fileStartsWithAppend(text: string): boolean {
  return isAppendFile(text);
}

function stripAppend(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let skipped = false;
  for (const line of lines) {
    if (!skipped && line.trim() === 'APPEND') {
      skipped = true;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

export function parsePrimaryStats(text: string): PrimaryStat[] {
  const list: PrimaryStat[] = [];
  let current: PrimaryStat | null = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line === 'APPEND') continue;
    if (/^\[stat\]$/i.test(line)) {
      current = { id: '', name: '' };
      list.push(current);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0 || !current) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === 'id') current.id = value;
    else if (key === 'name') current.name = value;
  }
  return list.filter((stat) => stat.id);
}

export function serializePrimaryStats(stats: PrimaryStat[]): string {
  const lines = [
    '# Primary stats. Flare reads engine/primary_stats.txt.',
    '# Each [stat] needs an id (used in other files) and a display name.',
    '# Mods can add new primary stats; the list is not hardcoded.',
    '',
  ];
  for (const stat of stats) {
    const id = normalizeStatId(stat.id);
    if (!id) continue;
    lines.push('[stat]', `id=${id}`, `name=${stat.name.trim() || id}`, '');
  }
  return `${lines.join('\n').replace(/\n+$/, '\n')}`;
}

export function parseTitles(text: string): TitleEntry[] {
  const list: TitleEntry[] = [];
  let current: TitleEntry | null = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line === 'APPEND') continue;
    if (/^\[title\]$/i.test(line)) {
      current = emptyTitle();
      list.push(current);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0 || !current) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === 'title') current.title = value;
    else if (key === 'level') current.level = value;
    else if (key === 'power') current.power = value;
    else if (key === 'requires_status') current.requires_status = value;
    else if (key === 'requires_not_status') current.requires_not_status = value;
    else if (key === 'primary_stat') {
      const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
      current.primary_stat_1 = parts[0] || '';
      current.primary_stat_2 = parts[1] || '';
    }
  }
  return list;
}

export function serializeTitles(titles: TitleEntry[]): string {
  const lines = [
    '# Character titles. Flare reads engine/titles.txt.',
    '# The first title that matches the hero is used, so put stricter/higher titles first.',
    '',
  ];
  for (const title of titles) {
    if (!title.title.trim() && !title.level && !title.power && !title.primary_stat_1) continue;
    lines.push('[title]');
    if (title.primary_stat_1.trim()) {
      const value = title.primary_stat_2.trim()
        ? `${title.primary_stat_1.trim()},${title.primary_stat_2.trim()}`
        : title.primary_stat_1.trim();
      lines.push(`primary_stat=${value}`);
    }
    if (title.level.trim()) lines.push(`level=${title.level.trim()}`);
    if (title.power.trim()) lines.push(`power=${title.power.trim()}`);
    if (title.requires_status.trim()) lines.push(`requires_status=${title.requires_status.trim()}`);
    if (title.requires_not_status.trim()) lines.push(`requires_not_status=${title.requires_not_status.trim()}`);
    if (title.title.trim()) lines.push(`title=${title.title.trim()}`);
    lines.push('');
  }
  return `${lines.join('\n').replace(/\n+$/, '\n')}`;
}

function emptyScalars(): HeroStatsScalars {
  return {
    stat_points_per_level: '',
    max_points_per_stat: '',
    power_points_per_level: '',
    levelup_restore_hp: '',
    levelup_restore_mp: '',
    speed: '',
    sfx_step: '',
    cooldown: '',
    cooldown_hit: '',
    categories: '',
  };
}

function parseCsvPair(value: string): [string, string] {
  const comma = value.indexOf(',');
  if (comma < 0) return [value.trim(), ''];
  return [value.slice(0, comma).trim(), value.slice(comma + 1).trim()];
}

export function parseHeroStats(text: string): HeroStatsFile {
  const file = emptyHeroStats();
  file.scalars = emptyScalars();
  const lines = String(text || '').split(/\r?\n/);
  const trailing: string[] = [];
  let inTrailing = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (inTrailing) {
      trailing.push(raw);
      continue;
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inTrailing = true;
      trailing.push(raw);
      continue;
    }
    if (!trimmed || trimmed.startsWith('#') || trimmed === 'APPEND') continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      file.unknownLines.push(raw);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if ((HERO_STAT_SCALAR_KEYS as string[]).includes(key)) {
      file.scalars[key as keyof HeroStatsScalars] = value;
    } else if (key === 'stat') {
      const [id, amount] = parseCsvPair(value);
      if (id) file.base[id] = amount;
    } else if (key === 'stat_per_level') {
      const [id, amount] = parseCsvPair(value);
      if (id) file.perLevel[id] = amount;
    } else if (key === 'stat_per_primary') {
      const first = value.indexOf(',');
      const second = first >= 0 ? value.indexOf(',', first + 1) : -1;
      if (first > 0 && second > first) {
        file.perPrimary.push({
          primary: value.slice(0, first).trim(),
          stat: value.slice(first + 1, second).trim(),
          value: value.slice(second + 1).trim(),
        });
      }
    } else {
      file.unknownLines.push(raw);
    }
  }
  file.trailing = trailing.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
  return file;
}

export function serializeHeroStats(file: HeroStatsFile): string {
  const lines = [
    '# Avatar attribute definitions. Flare reads engine/stats.txt.',
    '# Core stat keys (hp, mp, accuracy, ...) are hardcoded in the engine.',
    '# Values, per-level growth and per-primary bonuses are mod-configurable.',
    '',
  ];
  const s = file.scalars;
  const emit = (key: keyof HeroStatsScalars) => {
    if (String(s[key] ?? '').trim() !== '') lines.push(`${key}=${s[key].trim()}`);
  };
  emit('stat_points_per_level');
  emit('max_points_per_stat');
  emit('power_points_per_level');
  emit('levelup_restore_hp');
  emit('levelup_restore_mp');
  if (lines[lines.length - 1] !== '') lines.push('');

  const ids = new Set<string>([...Object.keys(file.base), ...Object.keys(file.perLevel), ...file.perPrimary.map((row) => row.stat)]);
  const ordered = [
    ...CORE_STATS.map((stat) => stat.key).filter((key) => ids.has(key)),
    ...[...ids].filter((id) => !CORE_STAT_KEYS.has(id)).sort(),
  ];
  for (const id of ordered) {
    if (file.base[id] != null && file.base[id] !== '') lines.push(`stat=${id},${file.base[id]}`);
    if (file.perLevel[id] != null && file.perLevel[id] !== '') lines.push(`stat_per_level=${id},${file.perLevel[id]}`);
    if (file.base[id] || file.perLevel[id]) lines.push('');
  }
  for (const row of file.perPrimary) {
    if (row.primary && row.stat && row.value !== '') lines.push(`stat_per_primary=${row.primary},${row.stat},${row.value}`);
  }
  if (file.perPrimary.some((row) => row.primary && row.stat && row.value !== '')) lines.push('');

  emit('speed');
  emit('sfx_step');
  emit('cooldown');
  emit('cooldown_hit');
  emit('categories');
  for (const line of file.unknownLines) {
    if (line.trim()) lines.push(line);
  }
  if (file.trailing.trim()) {
    if (lines[lines.length - 1] !== '') lines.push('');
    lines.push(file.trailing.trim(), '');
  }
  return `${lines.join('\n').replace(/\n+$/, '\n')}`;
}

export function parseResourceStats(text: string): ResourceStat[] {
  const list: ResourceStat[] = [];
  let current: ResourceStat | null = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line === 'APPEND') continue;
    if (/^\[resource_stat\]$/i.test(line)) {
      current = emptyResourceStat();
      current.levelup_restore = '';
      list.push(current);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0 || !current) continue;
    const key = line.slice(0, eq).trim() as keyof ResourceStat;
    if ((RESOURCE_STAT_KEYS as string[]).includes(key)) current[key] = line.slice(eq + 1).trim();
  }
  return list.filter((stat) => stat.stat_base);
}

export function serializeResourceStats(stats: ResourceStat[]): string {
  if (!stats.length) {
    return '# No extra resource stats. HP and MP are hardcoded core stats; this file adds more MP-like pools.\n';
  }
  const lines = [
    '# Extra resource stats (MP-like pools). Flare reads engine/resource_stats.txt.',
    '',
  ];
  for (const stat of stats) {
    if (!stat.stat_base.trim()) continue;
    lines.push('[resource_stat]');
    for (const key of RESOURCE_STAT_KEYS) {
      if (String(stat[key] ?? '').trim() !== '') lines.push(`${key}=${String(stat[key]).trim()}`);
    }
    lines.push('');
  }
  return `${lines.join('\n').replace(/\n+$/, '\n')}`;
}

export function parseDamageTypes(text: string): DamageType[] {
  const list: DamageType[] = [];
  let current: DamageType | null = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line === 'APPEND') continue;
    if (/^\[damage_type\]$/i.test(line)) {
      current = { id: '', name: '', min: '', max: '', resist: '', elemental: '' };
      list.push(current);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0 || !current) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === 'id') current.id = value;
    else if (key === 'name') current.name = value;
    else if (key === 'min') current.min = value;
    else if (key === 'max') current.max = value;
    else if (key === 'resist') current.resist = value;
    else if (key === 'elemental') current.elemental = value;
  }
  return list.filter((type) => type.id).map((type) => ({
    ...type,
    min: type.min || `dmg_${type.id}_min`,
    max: type.max || `dmg_${type.id}_max`,
    resist: type.resist || `${type.id}_resist`,
  }));
}

export function resourceStatIds(resource: ResourceStat): string[] {
  return ['stat_base', 'stat_regen', 'stat_steal', 'stat_resist_steal']
    .map((key) => resource[key as keyof ResourceStat].trim())
    .filter(Boolean);
}

export function renamePrimaryInHeroStats(file: HeroStatsFile, from: string, to: string): HeroStatsFile {
  if (!from || from === to) return file;
  return {
    ...file,
    perPrimary: file.perPrimary.map((row) => row.primary === from ? { ...row, primary: to } : row),
  };
}

export { stripAppend };
