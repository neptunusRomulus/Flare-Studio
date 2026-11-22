import { describe, expect, it } from 'vitest';
import { buildEventInstanceProps } from '@/components/events/eventInstanceProps';
import type { EventData } from '@/components/events/eventDialogModel';

function eventData(patch: (data: EventData) => void = () => {}): EventData {
  const data: EventData = {
    name: 'Test event',
    description: '',
    positioning: {
      mapName: 'cave',
      coordinates: { x: 12, y: 34 },
      size: { width: 2, height: 2 },
      hotspot: { x: 1, y: 2, width: 1, height: 1 },
    },
    timing: { activeActivation: 'Trigger', cooldown: 0, delay: 0 },
    requirements: { status: [], minLevel: 0, itemRequirements: [], currency: 0 },
    rewards: {
      message: '', expReward: 0, rewardCurrency: 0, removeCurrency: 0,
      rewardItemId: '', rewardItemQuantity: 1, removeItemId: '', removeItemQuantity: 1,
      lootGroup: '', rewardLootGroup: '', rewardLootCountMin: 1, rewardLootCountMax: 1,
      enemySpawn: '', teleportMap: '', teleportX: 0, teleportY: 0, sound: '',
      power: '', powerPath: '', powerDamage: 0, powerStats: '', powerLevel: '',
      mapmod: '', mapmodToggle: '', requiresTile: '', requiresNotTile: '', spawnLevel: '',
      intermapId: '', procgenFilename: '', procgenLink: '', procgenDoorLevel: '',
      restore: '', npc: '', music: '', book: '',
      respec: false, showOnMinimap: false, parallaxLayers: '', randomStatus: '',
    },
    engine: { chance: 100, autoSave: false, script: '' },
  };
  patch(data);
  return data;
}

describe('buildEventInstanceProps', () => {
  it('writes location and hotspot for a placed Trigger', () => {
    const props = buildEventInstanceProps(eventData(), []);
    expect(props.activate).toBe('on_trigger');
    expect(props.location).toBe('12,34,2,2');
    expect(props.hotspot).toBe('1,2,1,1');
  });

  it('keeps an unplaced event out of the map file but keeps its activation', () => {
    const props = buildEventInstanceProps(eventData((data) => {
      data.positioning.coordinates = { x: -1, y: -1 };
    }), []);
    expect(props.location).toBeUndefined();
    expect(props.hotspot).toBeUndefined();
    expect(props.activate).toBe('on_trigger');
  });

  it('writes only the hotspot for an Interact event and only the area for a Leave event', () => {
    const interact = buildEventInstanceProps(eventData((data) => { data.timing.activeActivation = 'Interact'; }), []);
    expect(interact.hotspot).toBe('1,2,1,1');
    expect(interact.location).toBeUndefined();
    const leave = buildEventInstanceProps(eventData((data) => { data.timing.activeActivation = 'Leave'; }), []);
    expect(leave.location).toBe('12,34,2,2');
    expect(leave.hotspot).toBeUndefined();
  });

  it('collapses one requirement to a string and keeps several as an array', () => {
    const one = buildEventInstanceProps(eventData((data) => { data.requirements.status = ['quest_1']; }), []);
    expect(one.requires_status).toBe('quest_1');
    const two = buildEventInstanceProps(eventData((data) => {
      data.requirements.status = ['quest_1', 'quest_2'];
      data.requirements.itemRequirements = [
        { id: 'a', type: 'requires_item', itemId: 'apple', itemQuantity: 2 },
        { id: 'b', type: 'requires_item', itemId: 'pear', itemQuantity: 1 },
        { id: 'c', type: 'requires_not_item', itemId: 'rock', itemQuantity: 1 },
      ];
    }), []);
    expect(two.requires_status).toEqual(['quest_1', 'quest_2']);
    expect(two.requires_item).toEqual(['apple:2', 'pear:1']);
    expect(two.requires_not_item).toBe('rock:1');
  });

  it('never writes mapmod_toggle as the boolean word true', () => {
    const wordTrue = buildEventInstanceProps(eventData((data) => { data.rewards.mapmodToggle = 'TRUE'; }), []);
    expect(wordTrue.mapmod_toggle).toBeUndefined();
    const coords = buildEventInstanceProps(eventData((data) => { data.rewards.mapmodToggle = '1,2,3,4,5'; }), []);
    expect(coords.mapmod_toggle).toBe('1,2,3,4,5');
  });

  it('normalizes the teleport target into maps/<name>.txt and pairs the loot count', () => {
    const props = buildEventInstanceProps(eventData((data) => {
      data.rewards.teleportMap = 'dungeon_01';
      data.rewards.teleportX = 5;
      data.rewards.teleportY = 6;
      data.rewards.rewardLootGroup = 'loot/chest.txt';
      data.rewards.rewardLootCountMin = 2;
      data.rewards.rewardLootCountMax = 4;
    }), []);
    expect(props.intermap).toBe('maps/dungeon_01.txt,5,6');
    expect(props.reward_loot).toBe('loot/chest.txt');
    expect(props.reward_loot_count).toBe('2,4');
  });

  it('leaves chance_exec out at 100% and merges the extra property rows', () => {
    const props = buildEventInstanceProps(eventData(), [{ id: 'x1', key: 'set_status', value: 'quest_1' }]);
    expect(props.chance_exec).toBeUndefined();
    expect(props.set_status).toBe('quest_1');
  });
});
