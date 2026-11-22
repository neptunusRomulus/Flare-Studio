/** maps/random/lists/*.txt: ordered `map=filename,x,y` rows, comments and unknown lines kept. */

export const RANDOM_MAP_LISTS_DIR = 'maps/random/lists';

export type RandomMapRow = {
  kind: 'map';
  map: string;
  x: string;
  y: string;
};

export type RandomMapRaw = {
  kind: 'raw';
  raw: string;
};

export type RandomMapListLine = RandomMapRow | RandomMapRaw;

export function parseRandomMapList(text: string): RandomMapListLine[] {
  return String(text || '').split(/\r?\n/).map((raw) => {
    const trimmed = raw.trim();
    if (!trimmed.toLowerCase().startsWith('map=')) return { kind: 'raw', raw };
    const parts = trimmed.slice(4).split(',').map((part) => part.trim());
    return {
      kind: 'map',
      map: parts[0] || '',
      x: parts[1] || '',
      y: parts[2] || '',
    };
  });
}

export function serializeRandomMapList(lines: RandomMapListLine[]): string {
  return lines.map((line) => {
    if (line.kind === 'raw') return line.raw;
    const parts = [line.map.trim()];
    if (line.x.trim() || line.y.trim()) {
      parts.push(line.x.trim() || '0');
      parts.push(line.y.trim() || '0');
    }
    return `map=${parts.join(',')}`;
  }).join('\n');
}

export function randomMapListRelPath(slugInput: string): string {
  const slug = String(slugInput || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'list';
  return `${RANDOM_MAP_LISTS_DIR}/${slug}.txt`;
}
