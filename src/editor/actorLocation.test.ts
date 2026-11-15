import { describe, expect, it } from 'vitest';
import {
  applyExportLocation,
  mapLocationValue,
  propertiesWithSyncedLocation,
  updatesWithSyncedLocation,
} from './actorLocation';

describe('mapLocationValue', () => {
  it('formats x,y,w,h and defaults size to 1', () => {
    expect(mapLocationValue({ x: 4, y: 7, width: 2, height: 3 })).toBe('4,7,2,3');
    expect(mapLocationValue({ x: 0, y: 0 })).toBe('0,0,1,1');
  });
});

describe('applyExportLocation', () => {
  it('lets live x,y win over a stale properties.location after an imported NPC is moved', () => {
    const npc = {
      x: 3,
      y: 4,
      width: 1,
      height: 1,
      properties: { location: '3,4,1,1', npcFilename: 'npcs/guard.txt' },
    };
    npc.x = 9;
    npc.y = 2;
    const record: Record<string, unknown> = { ...npc.properties };
    applyExportLocation(record, npc);
    expect(record.location).toBe('9,2,1,1');
  });

  it('overwrites stale location even when properties were not synced on the move', () => {
    const enemy = {
      x: 10,
      y: 12,
      width: 1,
      height: 1,
      properties: { location: '1,1,1,1', category: 'antlion' },
    };
    const record: Record<string, unknown> = { ...enemy.properties };
    applyExportLocation(record, enemy);
    expect(record.location).toBe('10,12,1,1');
  });
});

describe('updatesWithSyncedLocation', () => {
  it('rewrites properties.location when x,y change, and leaves it alone otherwise', () => {
    const current = { x: 1, y: 1, width: 1, height: 1, properties: { location: '1,1,1,1', filename: 'npcs/a.txt' } };
    const moved = updatesWithSyncedLocation(current, { x: 5, y: 6 });
    expect(moved.properties).toEqual({ location: '5,6,1,1', filename: 'npcs/a.txt' });
    expect(updatesWithSyncedLocation(current, { properties: { filename: 'npcs/b.txt' } }).properties).toEqual({
      filename: 'npcs/b.txt',
    });
  });

  it('keeps other properties passed in the same update', () => {
    const current = { x: 0, y: 0, width: 1, height: 1, properties: { location: '0,0,1,1' } };
    const updated = updatesWithSyncedLocation(current, {
      x: 2,
      y: 3,
      properties: { location: '0,0,1,1', hotspot: '2,3,1,1' },
    });
    expect(updated.properties).toEqual({ location: '2,3,1,1', hotspot: '2,3,1,1' });
  });
});

describe('propertiesWithSyncedLocation', () => {
  it('copies existing properties and sets location from x,y', () => {
    expect(
      propertiesWithSyncedLocation({
        x: 8,
        y: 1,
        width: 2,
        height: 1,
        properties: { location: '0,0,1,1', npcFilename: 'npcs/a.txt' },
      }),
    ).toEqual({ location: '8,1,2,1', npcFilename: 'npcs/a.txt' });
  });
});
