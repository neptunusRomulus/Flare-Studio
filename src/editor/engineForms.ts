/** Parse/serialize a few engine/*.txt files that have a simple repeating shape. */

export type XpRow = { level: string; xp: string };
export type HeroOption = { index: string; base: string; head: string; portrait: string; name: string };
export type HeroLayer = { direction: string; types: string };
export type LootSettings = {
  currency_name: string;
  vendor_ratio_buy: string;
  vendor_ratio_sell: string;
  vendor_ratio_sell_old: string;
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
  'currency_name', 'vendor_ratio_buy', 'vendor_ratio_sell', 'vendor_ratio_sell_old',
];

export function parseLootSettings(text: string): LootSettings {
  const out: LootSettings = { currency_name: '', vendor_ratio_buy: '', vendor_ratio_sell: '', vendor_ratio_sell_old: '' };
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
  const out = rows.map((raw) => {
    const trimmed = raw.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return raw;
    const key = trimmed.slice(0, eq).trim() as keyof LootSettings;
    if (!LOOT_KEYS.includes(key)) return raw;
    seen.add(key);
    const indent = raw.slice(0, raw.length - raw.trimStart().length);
    return `${indent}${key}=${next[key] ?? ''}`;
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
