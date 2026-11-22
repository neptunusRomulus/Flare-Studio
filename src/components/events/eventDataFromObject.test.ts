import { describe, expect, it } from 'vitest';
import { eventDataFromObject, parseItemValue } from '@/components/events/eventDataFromObject';
import { buildEventInstanceProps } from '@/components/events/eventInstanceProps';
import type { EventData } from '@/components/events/eventDialogModel';

const empty: EventData = {
  name: 'Chest',
  description: 'A wooden chest',
  positioning: {
    mapName: 'cave',
    coordinates: { x: 3, y: 4 },
    size: { width: 2, height: 1 },
    hotspot: { x: 1, y: 1, width: 2, height: 1 },
  },
  timing: { activeActivation: 'Interact', cooldown: 1500, delay: 250 },
  requirements: {
    status: ['quest_1', 'quest_2'],
    minLevel: 3,
    itemRequirements: [{ id: 'a', type: 'requires_item', itemId: 'apple', itemQuantity: 2 }],
    currency: 10,
  },
  rewards: {
    message: 'You win', expReward: 5, rewardCurrency: 7, removeCurrency: 2,
    rewardItemId: 'sword', rewardItemQuantity: 1, removeItemId: '', removeItemQuantity: 1,
    lootGroup: 'loot/chest.txt', rewardLootGroup: 'loot/bonus.txt', rewardLootCountMin: 2, rewardLootCountMax: 3,
    enemySpawn: 'goblin', teleportMap: 'dungeon_01', teleportX: 5, teleportY: 6, sound: 'chest.ogg',
    power: '', powerPath: '', powerDamage: 0, powerStats: '', powerLevel: '',
    mapmod: '', mapmodToggle: '', requiresTile: '', requiresNotTile: '', spawnLevel: '',
    intermapId: '', procgenFilename: '', procgenLink: '', procgenDoorLevel: '',
    restore: '', npc: '', music: 'cave.ogg', book: '',
    respec: false, showOnMinimap: true, parallaxLayers: '', randomStatus: '',
  },
  engine: { chance: 40, autoSave: true, script: 'scripts/chest.txt' },
};

describe('eventDataFromObject', () => {
  it('reads back what buildEventInstanceProps wrote', () => {
    const properties = buildEventInstanceProps(empty, []);
    const data = eventDataFromObject({ properties, name: empty.name, description: empty.description, x: 3, y: 4, width: 2, height: 1, mapName: 'cave' });
    expect(data.timing.activeActivation).toBe('Interact');
    expect(data.timing.cooldown).toBe(1500);
    expect(data.timing.delay).toBe(250);
    expect(data.requirements).toMatchObject({ status: ['quest_1', 'quest_2'], minLevel: 3, currency: 10 });
    expect(data.rewards.rewardLootGroup).toBe('loot/bonus.txt');
    expect(data.rewards.teleportMap).toBe('dungeon_01');
    expect(data.rewards.showOnMinimap).toBe(true);
    expect(data.engine).toEqual({ chance: 40, autoSave: true, script: 'scripts/chest.txt' });
  });

  it('falls back to the new-event defaults for an empty object', () => {
    const data = eventDataFromObject({ properties: {} });
    expect(data.positioning.hotspot).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(data.positioning.size).toEqual({ width: 1, height: 1 });
    expect(data.timing).toEqual({ activeActivation: null, cooldown: 0, delay: 0 });
    expect(data.requirements.itemRequirements).toEqual([]);
    expect(data.engine.chance).toBe(100);
  });

  it('turns one item string into one requirement row and accepts a list', () => {
    const single = eventDataFromObject({ properties: { requires_item: 'apple:2' } });
    expect(single.requirements.itemRequirements).toHaveLength(1);
    expect(single.requirements.itemRequirements[0]).toMatchObject({ type: 'requires_item', itemId: 'apple', itemQuantity: 2 });
    const many = eventDataFromObject({ properties: { requires_not_item: ['rock:1', 'sand:4'] } });
    expect(many.requirements.itemRequirements.map((row) => row.itemId)).toEqual(['rock', 'sand']);
  });

  it('keeps the mapmod toggle only when it is not the boolean word', () => {
    expect(eventDataFromObject({ properties: { mapmod_toggle: 'true' } }).rewards.mapmodToggle).toBe('');
    expect(eventDataFromObject({ properties: { mapmod_toggle: '1,2,3' } }).rewards.mapmodToggle).toBe('1,2,3');
  });
});

describe('parseItemValue', () => {
  it('accepts the separators the engine files use', () => {
    expect(parseItemValue('apple:3')).toEqual({ id: 'apple', quantity: 3 });
    expect(parseItemValue('apple 3')).toEqual({ id: 'apple', quantity: 3 });
    expect(parseItemValue('apple,3')).toEqual({ id: 'apple', quantity: 3 });
    expect(parseItemValue('apple')).toEqual({ id: 'apple', quantity: 1 });
  });
});
