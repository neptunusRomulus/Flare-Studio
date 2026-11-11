/**
 * Loot chance words, compact loot= parsing, and expected-drop math.
 *
 * Engine (LootManager::parseLoot / checkLoot, c6772106):
 * - Compact form: loot=id,chance,qty_min,qty_max  (repeatable on one line)
 * - chance "fixed" is stored as 0 and always drops, once, before the random pick
 * - A chance of 100 is not "fixed": it still competes with lower-chance items
 * - One uniform roll 0–100 picks at most one random item: among items whose
 *   chance >= roll, only those with the lowest such chance can drop (ties
 *   split evenly). Loot table files are inlined into that same pool.
 * - loot_count (or engine drop_max, default 1) is how many random rolls happen
 *   per kill. Fixed items are removed after the first roll, so they drop once.
 */

export const LOOT_CHANCE_WORDS = [
  { word: 'Always', value: 'fixed' as const },
  { word: 'Often', value: '50' },
  { word: 'Sometimes', value: '20' },
  { word: 'Rare', value: '5' },
  { word: 'Very rare', value: '1' },
] as const;

export type LootChanceWord = (typeof LOOT_CHANCE_WORDS)[number]['word'];

export type LootChanceValue =
  | { kind: 'word'; word: LootChanceWord; stored: 'fixed' | '50' | '20' | '5' | '1' }
  | { kind: 'custom'; percent: number; stored: string };

const WORD_BY_STORED: Record<string, LootChanceWord> = {
  fixed: 'Always',
  '50': 'Often',
  '20': 'Sometimes',
  '5': 'Rare',
  '1': 'Very rare',
};

export function parseLootChance(raw: string | number | null | undefined): LootChanceValue {
  const stored = String(raw ?? '').trim();
  if (!stored) return { kind: 'custom', percent: 0, stored: '' };
  if (stored.toLowerCase() === 'fixed') return { kind: 'word', word: 'Always', stored: 'fixed' };
  const word = WORD_BY_STORED[stored];
  if (word) return { kind: 'word', word, stored: stored as '50' | '20' | '5' | '1' };
  const percent = Number(stored);
  return { kind: 'custom', percent: Number.isFinite(percent) ? percent : 0, stored };
}

export function formatLootChance(value: LootChanceValue): string {
  if (value.kind === 'word') return value.stored;
  if (value.stored !== '') return value.stored;
  if (Number.isInteger(value.percent)) return String(value.percent);
  return String(value.percent);
}

export function lootChanceLabel(value: LootChanceValue): string {
  if (value.kind === 'word') return value.word;
  const n = Number.isFinite(value.percent) ? value.percent : Number(value.stored);
  const shown = Number.isFinite(n) ? String(n) : value.stored;
  return shown === '' ? 'Custom' : `Custom ${shown}%`;
}

/** Engine numeric chance used in the random pick. "fixed" is 0 and is not in that pick. */
export function lootChanceNumber(value: LootChanceValue): number {
  if (value.kind === 'word' && value.stored === 'fixed') return 0;
  if (value.kind === 'word') return Number(value.stored);
  return value.percent;
}

export function isFixedChance(value: LootChanceValue): boolean {
  return value.kind === 'word' && value.stored === 'fixed';
}

/** Engine treats chance 0 the same as "fixed", including a missing chance token. */
export function dropsAsFixed(value: LootChanceValue): boolean {
  return lootChanceNumber(value) === 0;
}

export type LootRow = {
  /** Item id, "currency", or a loot table path (loot/foo.txt). */
  id: string;
  chance: LootChanceValue;
  quantityMin: number;
  quantityMax: number;
  /** True when id is a loot table filename, not an item. */
  isTable: boolean;
  /** Original compact token string, for byte-identical rewrites when untouched. */
  raw?: string;
};

const looksLikeTable = (id: string) => {
  const s = id.trim();
  if (!s) return false;
  if (s === 'currency') return false;
  if (/^-?\d+$/.test(s)) return false;
  return true;
};

/**
 * Parse one loot= value into rows. The engine always reads
 * id, chance, qty_min, qty_max for a non-table entry (missing ints become 1).
 * A table filename stands alone and does not consume chance/qty.
 */
export function parseLootValue(value: string): LootRow[] {
  const tokens = String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  const rows: LootRow[] = [];
  let i = 0;
  while (i < tokens.length) {
    const id = tokens[i];
    i += 1;
    if (looksLikeTable(id)) {
      rows.push({
        id,
        chance: parseLootChance(''),
        quantityMin: 1,
        quantityMax: 1,
        isTable: true,
        raw: id,
      });
      continue;
    }
    const chanceRaw = i < tokens.length ? tokens[i] : '';
    if (i < tokens.length) i += 1;
    const minToken = i < tokens.length ? tokens[i] : '';
    if (i < tokens.length) i += 1;
    const maxToken = i < tokens.length ? tokens[i] : '';
    if (i < tokens.length) i += 1;
    const quantityMin = Math.max(1, toEngineInt(minToken));
    const quantityMax = Math.max(quantityMin, toEngineInt(maxToken) || quantityMin);
    rows.push({
      id,
      chance: parseLootChance(chanceRaw),
      quantityMin,
      quantityMax,
      isTable: false,
    });
  }
  return rows;
}

/** Same as Parse::toInt: unparsable tokens (including "") become 0. */
function toEngineInt(token: string): number {
  const n = Number(token);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** Parse a newline-joined properties.loot value (repeated loot= lines). */
export function parseLootProperty(value: string | null | undefined): LootRow[] {
  const text = String(value || '');
  if (!text.trim()) return [];
  const rows: LootRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const fromLine = parseLootValue(trimmed);
    if (fromLine.length === 1) fromLine[0].raw = trimmed;
    rows.push(...fromLine);
  }
  return rows;
}

/** Write one row to compact engine form: id,chance,min,max (omit default qty 1,1). */
export function formatLootRow(row: LootRow): string {
  if (row.isTable) return row.id;
  const chance = formatLootChance(row.chance);
  const min = Math.max(1, row.quantityMin || 1);
  const max = Math.max(min, row.quantityMax || min);
  if (!chance) {
    if (min === 1 && max === 1) return row.id;
    return `${row.id},,${min},${max}`;
  }
  if (min === 1 && max === 1) return `${row.id},${chance}`;
  if (min === max) return `${row.id},${chance},${min}`;
  return `${row.id},${chance},${min},${max}`;
}

export function formatLootProperty(rows: LootRow[]): string {
  return rows.map(formatLootRow).join('\n');
}

export type LootSummaryInput = {
  rows: LootRow[];
  /** loot_count min,max. If omitted, dropMax rolls (default 1). */
  lootCountMin?: number;
  lootCountMax?: number;
  dropMax?: number;
  /** Resolve a table path to its rows (already expanded or not). */
  expandTable?: (path: string) => LootRow[] | undefined;
  itemName?: (id: string) => string;
  currencyName?: string;
  kills?: number;
};

export type LootSummaryLine = {
  id: string;
  name: string;
  expected: number;
  isTable?: boolean;
};

function averageQty(row: LootRow): number {
  const min = Math.max(1, row.quantityMin || 1);
  const max = Math.max(min, row.quantityMax || min);
  return (min + max) / 2;
}

function flattenRows(rows: LootRow[], expandTable?: (path: string) => LootRow[] | undefined, seen = new Set<string>()): LootRow[] {
  const out: LootRow[] = [];
  for (const row of rows) {
    if (!row.isTable) {
      out.push(row);
      continue;
    }
    const key = row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const nested = expandTable?.(row.id);
    if (!nested) {
      out.push(row);
      continue;
    }
    out.push(...flattenRows(nested, expandTable, seen));
  }
  return out;
}

/**
 * Probability that each non-fixed item is chosen on a single random roll,
 * following LootManager::checkLoot (no item_find bonus, requirements assumed met).
 */
export function randomDropProbabilities(rows: LootRow[]): number[] {
  const chances = rows.map((row) => (dropsAsFixed(row.chance) || row.isTable ? null : lootChanceNumber(row.chance)));
  const distinct = [...new Set(chances.filter((c): c is number => c != null && c > 0))].sort((a, b) => a - b);
  const probs = rows.map(() => 0);
  let prev = 0;
  for (const band of distinct) {
    const width = (band - prev) / 100;
    const indexes = rows.map((_, i) => i).filter((i) => chances[i] === band);
    if (indexes.length && width > 0) {
      const share = width / indexes.length;
      for (const i of indexes) probs[i] += share;
    }
    prev = band;
  }
  return probs;
}

export function expectedDropsPerKill(input: LootSummaryInput): LootSummaryLine[] {
  const flat = flattenRows(input.rows, input.expandTable);
  const dropMax = Math.max(1, input.dropMax ?? 1);
  const countMin = input.lootCountMin && input.lootCountMin > 0 ? input.lootCountMin : dropMax;
  const countMax = input.lootCountMax && input.lootCountMax > 0 ? Math.max(countMin, input.lootCountMax) : countMin;
  const rolls = (countMin + countMax) / 2;

  const unresolvedTables = flat.filter((row) => row.isTable);
  const items = flat.filter((row) => !row.isTable);
  const probs = randomDropProbabilities(items);
  const totals = new Map<string, { expected: number; isTable?: boolean }>();

  items.forEach((row, i) => {
    const qty = averageQty(row);
    const expected = dropsAsFixed(row.chance) ? qty : probs[i] * rolls * qty;
    const prev = totals.get(row.id);
    totals.set(row.id, { expected: (prev?.expected || 0) + expected });
  });
  for (const row of unresolvedTables) {
    totals.set(row.id, { expected: 0, isTable: true });
  }

  const currencyName = input.currencyName || 'Gold';
  const nameOf = (id: string) => {
    if (id === 'currency') return currencyName;
    return input.itemName?.(id) || id;
  };

  return [...totals.entries()]
    .map(([id, info]) => ({ id, name: info.isTable ? id : nameOf(id), expected: info.expected, isTable: info.isTable }))
    .sort((a, b) => Number(b.isTable) - Number(a.isTable) || b.expected - a.expected || a.name.localeCompare(b.name));
}

export function formatLootSummary(input: LootSummaryInput): string {
  const kills = input.kills ?? 10;
  const lines = expectedDropsPerKill(input).map((line) => {
    if (line.isTable) return line.name;
    const total = line.expected * kills;
    const shown = formatExpectedCount(total);
    return `${shown} ${line.name}`;
  });
  if (!lines.length) return '';
  return `Over ${kills} kills you get on average: ${lines.join(', ')}`;
}

export function formatExpectedCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (Number.isInteger(value)) return String(value);
  if (value >= 10) return String(Math.round(value));
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function parseLootCount(value: string | null | undefined): { min?: number; max?: number } {
  const parts = String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return {};
  const min = Math.max(1, Number(parts[0]) || 1);
  const max = parts[1] ? Math.max(min, Number(parts[1]) || min) : undefined;
  return { min, max };
}

/** Parse a loot table file body (loot=/status_loot= shorthand and [loot] blocks) into rows. */
export function parseLootTableText(content: string): LootRow[] {
  const rows: LootRow[] = [];
  let block: { id?: string; chance?: string; quantity?: string } | null = null;
  const flush = () => {
    if (!block?.id) {
      block = null;
      return;
    }
    const qty = String(block.quantity || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const min = qty[0] ? Math.max(1, Number(qty[0]) || 1) : 1;
    const max = qty[1] ? Math.max(min, Number(qty[1]) || min) : min;
    rows.push({
      id: block.id,
      chance: parseLootChance(block.chance || ''),
      quantityMin: min,
      quantityMax: max,
      isTable: looksLikeTable(block.id),
    });
    block = null;
  };
  for (const raw of String(content || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    if (line.toUpperCase().startsWith('INCLUDE ')) {
      flush();
      rows.push({
        id: line.slice(8).trim(),
        chance: parseLootChance(''),
        quantityMin: 1,
        quantityMax: 1,
        isTable: true,
      });
      continue;
    }
    if (line.toLowerCase() === '[loot]') {
      flush();
      block = {};
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (block) {
      if (key === 'id') block.id = value;
      else if (key === 'chance') block.chance = value;
      else if (key === 'quantity') block.quantity = value;
      continue;
    }
    if (key === 'loot' || key === 'status_loot') {
      flush();
      const payload = key === 'status_loot' ? stripStatusLootPrefix(value) : value;
      rows.push(...parseLootValue(payload));
    }
  }
  flush();
  return rows;
}

/** status_loot=status,item,chance,... — drop the leading status token. */
function stripStatusLootPrefix(value: string): string {
  const tokens = value.split(',');
  if (tokens.length <= 1) return value;
  return tokens.slice(1).join(',');
}
