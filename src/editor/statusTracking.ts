/** Project-wide campaign-status index: keys from EventManager, QuestLog, NPC, ItemManager, Map, titles, books and classes. */

export type StatusRole = 'set' | 'unset' | 'require' | 'require_not' | 'other';

export type StatusHit = {
  status: string;
  role: StatusRole;
  key: string;
  file: string;
  line: number;
  value: string;
};

const KEY_ROLE: Record<string, StatusRole> = {
  set_status: 'set',
  pickup_status: 'set',
  defeat_status: 'set',
  convert_status: 'set',
  complete_status: 'set',
  campaign: 'set',
  procgen_unique_status: 'set',
  unset_status: 'unset',
  requires_status: 'require',
  vendor_requires_status: 'require',
  visible_requires_status: 'require',
  invincible_requires_status: 'require',
  loot_requires_status: 'require',
  'loot.requires_status': 'require',
  requires_not_status: 'require_not',
  vendor_requires_not_status: 'require_not',
  visible_requires_not_status: 'require_not',
  invincible_requires_not_status: 'require_not',
  show_status: 'other',
  procgen_reset_status: 'other',
};

function splitList(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

function add(hits: StatusHit[], status: string, role: StatusRole, key: string, file: string, line: number, value: string) {
  const name = status.trim();
  if (!name) return;
  hits.push({ status: name, role, key, file, line, value });
}

/** Collect campaign status mentions from one engine text file. */
export function collectStatusHitsFromText(file: string, text: string): StatusHit[] {
  const hits: StatusHit[] = [];
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  lines.forEach((raw, index) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || /^INCLUDE\s+/i.test(trimmed)) return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    const line = index + 1;
    if (key === 'random_status') {
      const [action, ...rest] = splitList(value);
      if (action === 'append') rest.forEach((status) => add(hits, status, 'other', key, file, line, value));
      return;
    }
    if (key === 'quest_loot') {
      const [required, forbidden] = splitList(value);
      add(hits, required, 'require', key, file, line, value);
      add(hits, forbidden, 'require_not', key, file, line, value);
      return;
    }
    if (key === 'status_loot') {
      const [required] = splitList(value);
      add(hits, required, 'require', key, file, line, value);
      return;
    }
    if (key === 'status_stock' || key === 'craft_status_stock') {
      const [required] = splitList(value);
      add(hits, required, 'require', key, file, line, value);
      return;
    }
    const role = KEY_ROLE[key];
    if (!role) return;
    splitList(value).forEach((status) => add(hits, status, role, key, file, line, value));
  });
  return hits;
}

export type StatusRow = {
  status: string;
  set: StatusHit[];
  unset: StatusHit[];
  require: StatusHit[];
  require_not: StatusHit[];
  other: StatusHit[];
};

export function groupStatusHits(hits: StatusHit[]): StatusRow[] {
  const map = new Map<string, StatusRow>();
  for (const hit of hits) {
    let row = map.get(hit.status);
    if (!row) {
      row = { status: hit.status, set: [], unset: [], require: [], require_not: [], other: [] };
      map.set(hit.status, row);
    }
    row[hit.role].push(hit);
  }
  return [...map.values()].sort((a, b) => a.status.localeCompare(b.status));
}
