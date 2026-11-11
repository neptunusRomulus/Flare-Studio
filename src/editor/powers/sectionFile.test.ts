import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { appendBlock, blockValues, joinSectionFile, parseSectionFile, removeBlock, setBlockValue, setBlockValues } from './sectionFile';

const FIX = path.resolve(__dirname, '../../../tests/fixtures/flare-powers');
const powers = fs.readFileSync(path.join(FIX, 'powers.txt'), 'utf8');
const effects = fs.readFileSync(path.join(FIX, 'effects.txt'), 'utf8');

describe('section file editor', () => {
  it('round-trips flare-game power and effect files byte-for-byte', () => {
    expect(joinSectionFile(parseSectionFile(powers, 'power'))).toBe(powers);
    expect(joinSectionFile(parseSectionFile(effects, 'effect'))).toBe(effects);
    expect(parseSectionFile(powers, 'power').blocks.length).toBeGreaterThan(3);
  });

  it('rewrites only the edited line and returns the same text for a no-op', () => {
    const file = parseSectionFile(powers, 'power');
    const block = file.blocks[0];
    const name = blockValues(block, 'name')[0];
    expect(setBlockValue(powers, 'power', 0, 'name', name)).toBe(powers);
    const renamed = setBlockValue(powers, 'power', 0, 'name', 'Renamed');
    const a = powers.split('\n');
    const b = renamed.split('\n');
    expect(b.length).toBe(a.length);
    expect(a.filter((line, i) => line !== b[i])).toEqual([`name=${name}`]);
  });

  it('adds, repeats and removes keys inside the block only', () => {
    const text = '# c\n[power]\nid=1\nname=A\npost_effect=x,1,1s\n\n[power]\nid=2\n';
    const added = setBlockValues(text, 'power', 0, 'post_effect', ['x,1,1s', 'y,2,2s']);
    expect(added).toBe('# c\n[power]\nid=1\nname=A\npost_effect=x,1,1s\npost_effect=y,2,2s\n\n[power]\nid=2\n');
    expect(setBlockValues(added, 'power', 0, 'post_effect', ['x,1,1s'])).toBe(text);
    expect(setBlockValue(text, 'power', 0, 'cooldown', '2s')).toBe('# c\n[power]\nid=1\nname=A\npost_effect=x,1,1s\ncooldown=2s\n\n[power]\nid=2\n');
    expect(setBlockValue(text, 'power', 1, 'name', 'B')).toBe('# c\n[power]\nid=1\nname=A\npost_effect=x,1,1s\n\n[power]\nid=2\nname=B\n');
  });

  it('appends and removes whole blocks', () => {
    const text = '[power]\nid=1\n\n[power]\nid=2\n';
    const appended = appendBlock(text, 'power', [['id', '3'], ['name', 'C']]);
    expect(appended).toBe('[power]\nid=1\n\n[power]\nid=2\n\n[power]\nid=3\nname=C\n');
    expect(removeBlock(appended, 'power', 2)).toBe('[power]\nid=1\n\n[power]\nid=2\n');
    expect(removeBlock(text, 'power', 0)).toBe('[power]\nid=2\n');
  });
});
