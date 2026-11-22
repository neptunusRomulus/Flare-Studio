import { describe, expect, it } from 'vitest';
import { formatAnimationFrames, isValidTileAnimationId, parseAnimationFrames, parseTilesetAnimations, serializeTilesetAnimations } from './tilesetAnimation';

describe('tileset animations', () => {
  it('parses animation lines and keeps tiles/comments', () => {
    const lines = parseTilesetAnimations('[tileset]\nimg=images/tilesets/cave.png\ntile=1,0,0,32,32\nanimation=192;1536,192,250ms;1536,960,250ms;\n');
    expect(lines.filter((line) => line.kind === 'animation')).toEqual([
      { kind: 'animation', id: '192', frames: [{ x: '1536', y: '192', duration: '250ms' }, { x: '1536', y: '960', duration: '250ms' }] },
    ]);
    expect(serializeTilesetAnimations(lines)).toContain('tile=1,0,0,32,32');
  });

  it('formats frames and validates ids', () => {
    expect(parseAnimationFrames('0,0,66ms;384,0,66ms')).toEqual([{ x: '0', y: '0', duration: '66ms' }, { x: '384', y: '0', duration: '66ms' }]);
    expect(formatAnimationFrames([{ x: '0', y: '0', duration: '66ms' }])).toBe('0,0,66ms');
    expect(isValidTileAnimationId('381')).toBe(true);
    expect(isValidTileAnimationId('tile')).toBe(false);
  });
});
