import { describe, expect, it } from 'vitest';
import { buildEventInstanceUpdate } from '@/components/events/eventInstanceUpdate';
import type { EventData } from '@/components/events/eventDialogModel';

function eventData(patch: (data: EventData) => void = () => {}): EventData {
  const data: EventData = {
    name: '',
    description: '',
    positioning: {
      mapName: 'cave',
      coordinates: { x: 7, y: 8 },
      size: { width: 1, height: 1 },
      hotspot: { x: 0, y: 0, width: 1, height: 1 },
    },
    timing: { activeActivation: null, cooldown: 0, delay: 0 },
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

describe('buildEventInstanceUpdate', () => {
  it('writes the position and a fallback name and activation', () => {
    const update = buildEventInstanceUpdate({ eventData: eventData(), extraRows: [] });
    expect(update).toMatchObject({
      name: 'Event', description: '', type: 'event', activate: 'on_trigger', x: 7, y: 8, width: 1, height: 1,
    });
  });

  it('builds the instance from the form plus the extra rows', () => {
    const update = buildEventInstanceUpdate({
      eventData: eventData((data) => { data.requirements.status = ['quest_1']; }),
      extraRows: [{ id: 'r1', key: 'reachable_from', value: '1,2,3,4' }],
    });
    expect(update.properties.reachable_from).toBe('1,2,3,4');
    expect(update.properties.requires_status).toBe('quest_1');
  });

  it('drops values the form no longer emits, and keys that are not engine keys', () => {
    const update = buildEventInstanceUpdate({
      eventData: eventData(),
      extraRows: [],
      existingProperties: { cooldown: '3000', not_an_engine_key: 'x' },
    });
    expect(update.properties.cooldown).toBeUndefined();
    expect(update.properties.not_an_engine_key).toBeUndefined();
  });

  it('lets the resolved script path override the form value', () => {
    const update = buildEventInstanceUpdate({
      eventData: eventData((data) => { data.engine.script = 'scripts/old.txt'; }),
      extraRows: [],
      script: 'scripts/new.txt',
    });
    expect(update.properties.script).toBe('scripts/new.txt');
  });

  it('translates the activation into the engine word', () => {
    const update = buildEventInstanceUpdate({
      eventData: eventData((data) => { data.timing.activeActivation = 'MapClear'; }),
      extraRows: [],
    });
    expect(update.activate).toBe('on_clear');
  });
});
