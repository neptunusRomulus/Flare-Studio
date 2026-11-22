import { FLARE_TO_ACTIVATION, type EventData, type EventItemRequirement } from '@/components/events/eventDialogModel';

/** `apple:3`, `apple 3`, `apple,3` → `{ id: 'apple', quantity: 3 }`. */
export function parseItemValue(value: string): { id: string; quantity: number } {
  const [id, quantity] = String(value || '').split(/[: ,]/).map((part) => part.trim());
  return { id: id || '', quantity: parseInt(quantity || '1', 10) || 1 };
}

type PropertyBag = Record<string, string | string[] | undefined>;

function asList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return value ? [String(value).trim()] : [];
}

function ms(value: string | string[] | undefined): number {
  return parseInt(String(value || '0').replace('ms', '')) || 0;
}

function num(value: string | string[] | undefined, fallback = 0): number {
  return parseInt(String(value || '0')) || fallback;
}

function mapNameFromIntermap(value: string): string {
  return String(value || '').replace(/^\/?(maps\/)/i, '').replace(/\.txt$/i, '');
}

export type EventObjectSource = {
  properties: PropertyBag;
  name?: string;
  description?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  activate?: string;
  mapName?: string | null;
};

/**
 * A map object's properties back into the form model — the inverse of `buildEventInstanceProps`.
 * Missing or malformed values fall back to the same defaults the dialog shows for a new event.
 */
export function eventDataFromObject(source: EventObjectSource): EventData {
  const p = source.properties || {};
  const hotParts = String(p.hotspot || '').split(',').map(Number);
  const hotspot = hotParts.length === 4 && hotParts.every((n) => !isNaN(n))
    ? { x: hotParts[0], y: hotParts[1], width: hotParts[2], height: hotParts[3] }
    : { x: 0, y: 0, width: 1, height: 1 };

  const itemRequirements: EventItemRequirement[] = [
    ...asList(p.requires_item).map((item) => {
      const parsed = parseItemValue(item);
      return {
        id: `item-req-${Math.random().toString(36).slice(2)}`,
        type: 'requires_item' as const,
        itemId: parsed.id,
        itemQuantity: parsed.quantity,
      };
    }),
    ...asList(p.requires_not_item).map((item) => {
      const parsed = parseItemValue(item);
      return {
        id: `item-req-${Math.random().toString(36).slice(2)}`,
        type: 'requires_not_item' as const,
        itemId: parsed.id,
        itemQuantity: parsed.quantity,
      };
    }),
  ];

  const rewardItem = parseItemValue(String(p.reward_item || ''));
  const removeItem = parseItemValue(String(p.remove_item || ''));
  const lootCount = String(p.reward_loot_count || '').split(',').map((part) => parseInt(part.trim(), 10) || 0);
  const intermap = String(p.intermap || '').split(',');
  const intermapMap = intermap.length >= 3 ? mapNameFromIntermap(intermap[0]) : mapNameFromIntermap(String(p.intermap || ''));

  return {
    name: source.name || '',
    description: source.description || String(p._description || ''),
    positioning: {
      mapName: source.mapName || '',
      coordinates: { x: source.x ?? 0, y: source.y ?? 0 },
      size: { width: source.width ?? 1, height: source.height ?? 1 },
      hotspot,
    },
    timing: {
      activeActivation: FLARE_TO_ACTIVATION[String(p.activate || source.activate || '')] || null,
      cooldown: ms(p.cooldown),
      delay: ms(p.delay),
    },
    requirements: {
      status: asList(p.requires_status),
      minLevel: num(p.requires_level),
      itemRequirements,
      currency: num(p.requires_currency),
    },
    rewards: {
      message: String(p.msg || ''),
      expReward: num(p.reward_xp),
      rewardCurrency: num(p.reward_currency),
      removeCurrency: num(p.remove_currency),
      rewardItemId: rewardItem.id,
      rewardItemQuantity: rewardItem.quantity,
      removeItemId: removeItem.id,
      removeItemQuantity: removeItem.quantity,
      lootGroup: String(p.loot || ''),
      rewardLootGroup: String(p.reward_loot || ''),
      rewardLootCountMin: lootCount[0] || 1,
      rewardLootCountMax: lootCount[1] || (lootCount[0] || 1),
      enemySpawn: String(p.spawn || ''),
      teleportMap: intermapMap,
      teleportX: intermap.length >= 3 ? parseInt(intermap[1]) || 0 : 0,
      teleportY: intermap.length >= 3 ? parseInt(intermap[2]) || 0 : 0,
      sound: String(p.soundfx || ''),
      power: String(p.power || ''),
      powerPath: String(p.power_path || ''),
      powerDamage: num(p.power_damage),
      powerStats: String(p.power_stats || ''),
      powerLevel: String(p.power_level || ''),
      mapmod: String(p.mapmod || ''),
      mapmodToggle: p.mapmod_toggle && p.mapmod_toggle !== 'true' ? String(p.mapmod_toggle) : '',
      requiresTile: String(p.requires_tile || ''),
      requiresNotTile: String(p.requires_not_tile || ''),
      spawnLevel: String(p.spawn_level || ''),
      intermapId: String(p.intermap_id || ''),
      procgenFilename: String(p.procgen_filename || ''),
      procgenLink: String(p.procgen_link || ''),
      procgenDoorLevel: String(p.procgen_door_level || ''),
      restore: String(p.restore || ''),
      npc: String(p.npc || ''),
      music: String(p.music || ''),
      book: String(p.book || ''),
      respec: p.respec === 'true',
      showOnMinimap: p.show_on_minimap === 'true',
      parallaxLayers: String(p.parallax_layers || ''),
      randomStatus: String(p.random_status || ''),
    },
    engine: {
      chance: num(p.chance_exec, 100) || 100,
      autoSave: p.save_game === 'true',
      script: String(p.script || ''),
    },
  };
}
