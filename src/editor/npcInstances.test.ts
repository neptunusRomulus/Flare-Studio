import { describe, expect, it } from 'vitest';
import {
  dedupeNpcInstances,
  npcFileForActor,
  npcInstanceCounts,
  npcInstanceFromMapRecord,
  npcInstanceFromObject,
  npcInstancesForFile,
  npcInstancesFromMapProject,
  npcInstancesFromMapText,
  normalizeNpcFile,
} from './npcInstances';

const actor = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Guard',
  type: 'npc',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  properties: {},
  ...overrides,
}) as Parameters<typeof npcInstanceFromObject>[0];

describe('npc instance identity', () => {
  it('normalizes every Flare file spelling to one key', () => {
    expect(normalizeNpcFile('npcs/Guard.txt')).toBe('npcs/guard.txt');
    expect(normalizeNpcFile('content/npcs/guard.txt')).toBe('npcs/guard.txt');
    expect(normalizeNpcFile('npcs\\guard.txt')).toBe('npcs/guard.txt');
    expect(normalizeNpcFile('guard.txt')).toBe('npcs/guard.txt');
    expect(normalizeNpcFile('')).toBe('');
    expect(normalizeNpcFile('/abs/guard.txt')).toBe('');
  });

  it('prefers the Studio NPC file, then the map filename, then the name slug', () => {
    expect(npcFileForActor(actor({ properties: { npcFilename: 'npcs/guard.txt' } }))).toBe('npcs/guard.txt');
    expect(npcFileForActor(actor({ properties: { filename: 'npcs/imported.txt' } }))).toBe('npcs/imported.txt');
    expect(npcFileForActor(actor({ name: 'Old Mill Guard' }))).toBe('npcs/old_mill_guard.txt');
  });
});

describe('npc instances from studio objects', () => {
  it('counts only placed NPCs', () => {
    expect(npcInstanceFromObject(actor({ x: -1, y: -1 }), 'a.json', 'A')).toBeNull();
    expect(npcInstanceFromObject(actor({ x: 2, y: 5 }), 'a.json', 'A')).toEqual({
      file: 'npcs/guard.txt',
      mapFile: 'a.json',
      mapTitle: 'A',
      x: 2,
      y: 5,
    });
    expect(npcInstanceFromObject(actor({ type: 'enemy', x: 1, y: 1 }), 'a.json', 'A')).toBeNull();
  });

  it('reads editor map projects', () => {
    const json = JSON.stringify({
      name: 'Town',
      objects: [
        { ...actor({ x: 3, y: 4, properties: { npcFilename: 'npcs/guard.txt' } }) },
        { ...actor({ id: 2, x: -1, y: -1 }) },
        { ...actor({ id: 3, x: 1, y: 1, properties: { filename: 'npcs/imported.txt' } }) },
      ],
    });
    const instances = npcInstancesFromMapProject(json, 'town.json');
    expect(instances).toHaveLength(2);
    expect(instances.map((i) => `${i.mapTitle}:${i.file}@${i.x},${i.y}`)).toEqual([
      'Town:npcs/guard.txt@3,4',
      'Town:npcs/imported.txt@1,1',
    ]);
  });

  it('reads exported Flare map text', () => {
    const text = [
      '[header]',
      'width=10',
      'height=8',
      'title=Town',
      '',
      '[npc]',
      'filename=npcs/guard.txt',
      'location=3,4,1,1',
      '',
      '[npc]',
      'filename=npcs/merchant.txt',
      'location=-1,-1,1,1',
      '',
    ].join('\n');
    const instances = npcInstancesFromMapText(text, 'town.txt');
    expect(instances).toEqual([
      { file: 'npcs/guard.txt', mapFile: 'town.txt', mapTitle: 'Town', x: 3, y: 4 },
    ]);
  });

  it('ignores records without a filename', () => {
    expect(npcInstanceFromMapRecord({ location: '1,2,1,1' }, 'a.txt', 'A')).toBeNull();
    expect(npcInstanceFromMapRecord({ filename: 'npcs/a.txt' }, 'a.txt', 'A')).toBeNull();
  });
});

describe('npc instance grouping', () => {
  const instances = [
    { file: 'npcs/guard.txt', mapFile: 'b.json', mapTitle: 'B', x: 1, y: 1 },
    { file: 'npcs/guard.txt', mapFile: 'a.json', mapTitle: 'A', x: 6, y: 2 },
    { file: 'npcs/guard.txt', mapFile: 'a.json', mapTitle: 'A', x: 2, y: 9 },
    { file: 'npcs/merchant.txt', mapFile: 'a.json', mapTitle: 'A', x: 0, y: 0 },
  ];

  it('counts per NPC file', () => {
    const counts = npcInstanceCounts(instances);
    expect(counts.get('npcs/guard.txt')).toBe(3);
    expect(counts.get('npcs/merchant.txt')).toBe(1);
    expect(counts.get('npcs/missing.txt')).toBeUndefined();
  });

  it('sorts a single NPC by map then coordinates', () => {
    expect(npcInstancesForFile(instances, 'npcs/guard.txt').map((i) => `${i.mapTitle}@${i.x},${i.y}`)).toEqual([
      'A@6,2',
      'A@2,9',
      'B@1,1',
    ]);
  });

  it('dedupes the same placement', () => {
    expect(dedupeNpcInstances([...instances, instances[0]])).toHaveLength(4);
  });
});
