import { exportMapText, slugFileName } from '../adapters/flare/flareAdapter.cjs';

const STARTING_MAP_INVALID_NAMES = new Set(['', 'untitled map', 'map name', 'untitled_map']);

const sanitizeMapFileBase = (rawName: string): string => slugFileName(rawName) || 'unnamed';

const computeIntermapTarget = (starting: boolean, rawName: string | undefined | null): string | null => {
  if (!starting) return null;
  const name = (rawName ?? '').trim();
  if (!name) return null;
  if (STARTING_MAP_INVALID_NAMES.has(name.toLowerCase())) return null;
  const sanitized = sanitizeMapFileBase(name);
  return `maps/${sanitized}.txt`;
};

const buildSpawnContent = (
  intermapTarget: string | null,
  heroPos?: { x: number; y: number }
): string => {
  let intermap = intermapTarget ?? '';
  if (intermapTarget && heroPos !== undefined) {
    intermap = `${intermapTarget},${heroPos.x},${heroPos.y}`;
  }
  const event: Record<string, string> = {
    activate: 'on_load',
    location: '0,0,1,1',
  };
  if (intermap) event.intermap = intermap;
  const exported = exportMapText({
    width: 1,
    height: 1,
    heroX: 0,
    heroY: 0,
    layers: [],
    events: [event],
  });
  return [
    '# this file is automatically loaded when a New Game starts.',
    "# it's a dummy map to send the player to the actual starting point.",
    '',
    exported.text,
  ].join('\n');
};

const extractSpawnIntermapValue = (content: string | null | undefined): string | null => {
  if (!content) return null;
  const match = content.match(/^\s*intermap\s*=\s*(.*)$/m);
  if (!match) return null;
  // Strip optional trailing hero coords (e.g. "maps/foo.txt,20,20" → "maps/foo.txt")
  const value = match[1].trim().replace(/,\s*-?\d+\s*,\s*-?\d+\s*$/, '');
  return value ? value : null;
};

export {
  STARTING_MAP_INVALID_NAMES,
  sanitizeMapFileBase,
  computeIntermapTarget,
  buildSpawnContent,
  extractSpawnIntermapValue
};
