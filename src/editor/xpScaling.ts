/**
 * enemies/xp_scaling/*.txt — XPScaling tables.
 * [absolute] multiplies XP by the enemy's level.
 * [relative] multiplies XP by (enemy level − player level).
 * Values outside the defined range use the nearest min or max.
 * An enemy points at a table with xp_scaling=enemies/xp_scaling/<file>.txt
 */

export const XP_SCALING_DIR = 'enemies/xp_scaling';
export const XP_SCALING_LIST_ID = 'xp-scaling-suggestions';

export type XpScaleRow = { level: string; multiplier: string };

export type XpScalingTable = {
  header: string;
  absolute: XpScaleRow[];
  relative: XpScaleRow[];
};

export type XpScalingEntry = { path: string; name: string };

export function emptyXpScalingTable(): XpScalingTable {
  return { header: '', absolute: [], relative: [] };
}

export function xpScalingRelPath(name: string): string {
  const slug = String(name || 'table')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^.*\//, '')
    .replace(/\.txt$/i, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'table';
  return `${XP_SCALING_DIR}/${slug}.txt`;
}

export function normalizeXpScalingPath(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const path = String(raw || '').trim().replace(/\\/g, '/').replace(/^\//, '');
  if (!path) return '';
  if (path.toLowerCase().startsWith(`${XP_SCALING_DIR}/`) && path.toLowerCase().endsWith('.txt')) return path;
  if (path.toLowerCase().endsWith('.txt')) return path.includes('/') ? path : `${XP_SCALING_DIR}/${path}`;
  return `${XP_SCALING_DIR}/${path}.txt`;
}

export function xpScalingDisplayName(path: string): string {
  return normalizeXpScalingPath(path).replace(new RegExp(`^${XP_SCALING_DIR}/`, 'i'), '').replace(/\.txt$/i, '') || path;
}

function parseRows(section: string, text: string): XpScaleRow[] {
  const rows: XpScaleRow[] = [];
  let current = '';
  for (const raw of String(text || '').split('\n')) {
    const header = raw.trim().match(/^\[([^\]]+)\]$/);
    if (header) {
      current = header[1].trim().toLowerCase();
      continue;
    }
    if (current !== section) continue;
    const match = raw.trim().match(/^level\s*=\s*([^,]+),(.*)$/);
    if (match) rows.push({ level: match[1].trim(), multiplier: match[2].trim() });
  }
  return rows;
}

export function parseXpScalingTable(text: string): XpScalingTable {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const header: string[] = [];
  let seen = false;
  for (const line of lines) {
    if (line.trim().match(/^\[(absolute|relative)\]$/i)) {
      seen = true;
      break;
    }
    header.push(line);
  }
  while (header.length && header[header.length - 1].trim() === '') header.pop();
  return {
    header: header.join('\n'),
    absolute: parseRows('absolute', text),
    relative: parseRows('relative', text),
  };
}

function emitSection(name: string, rows: XpScaleRow[]): string[] {
  const body = rows
    .filter((row) => row.level.trim() && row.multiplier.trim())
    .map((row) => `level=${row.level.trim()},${row.multiplier.trim()}`);
  if (!body.length) return [];
  return [`[${name}]`, ...body];
}

export function serializeXpScalingTable(table: XpScalingTable, previous = ''): string {
  const parsed = previous ? parseXpScalingTable(previous) : emptyXpScalingTable();
  const header = (table.header || parsed.header || '').replace(/\n+$/, '');
  const parts = [
    ...(header ? [header] : []),
    ...emitSection('absolute', table.absolute),
    ...emitSection('relative', table.relative),
  ];
  return `${parts.join('\n')}\n`;
}

export const DEFAULT_XP_SCALING = `[relative]
level=-10,0.25
level=0,1
level=10,1.5
`;
