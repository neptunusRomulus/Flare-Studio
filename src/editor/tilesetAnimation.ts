/** tilesetdefs/*.txt animation= lines: tile;x,y,duration;x,y,duration; */

export type TilesetAnimationFrame = { x: string; y: string; duration: string };

export type TilesetAnimationLine =
  | { kind: 'animation'; id: string; frames: TilesetAnimationFrame[] }
  | { kind: 'raw'; raw: string };

export function parseAnimationFrames(value: string): TilesetAnimationFrame[] {
  return String(value || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [x = '', y = '', duration = ''] = part.split(',').map((item) => item.trim());
    return { x, y, duration };
  });
}

export function formatAnimationFrames(frames: TilesetAnimationFrame[]): string {
  return frames.map((frame) => `${frame.x.trim()},${frame.y.trim()},${frame.duration.trim()}`).join(';');
}

export function parseTilesetAnimations(text: string): TilesetAnimationLine[] {
  return String(text || '').split(/\r?\n/).map((raw) => {
    const trimmed = raw.trim();
    if (!trimmed.toLowerCase().startsWith('animation=')) return { kind: 'raw', raw };
    const value = trimmed.slice('animation='.length);
    const semicolon = value.indexOf(';');
    const id = (semicolon >= 0 ? value.slice(0, semicolon) : value).trim();
    const frames = semicolon >= 0 ? parseAnimationFrames(value.slice(semicolon + 1)) : [];
    return { kind: 'animation', id, frames };
  });
}

export function serializeTilesetAnimations(lines: TilesetAnimationLine[]): string {
  return lines.map((line) => {
    if (line.kind === 'raw') return line.raw;
    const frames = formatAnimationFrames(line.frames);
    return frames ? `animation=${line.id.trim()};${frames};` : `animation=${line.id.trim()}`;
  }).join('\n');
}

/** Engine ids can be sparse; this only checks the numeric shape. */
export function isValidTileAnimationId(value: string): boolean {
  return /^\d+$/.test(String(value || '').trim());
}
