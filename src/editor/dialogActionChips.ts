import type { DialogueReward, DialogueWorldEffect } from '@/types';

export type DialogActionKind =
  | { group: 'reward'; type: DialogueReward['type'] }
  | { group: 'effect'; type: DialogueWorldEffect['type'] };

export type DialogActionCatalogEntry = {
  id: string;
  group: 'reward' | 'effect';
  type: string;
  label: string;
  flareKey: string;
  description: string;
};

export type DialogActionChip = {
  id: string;
  group: 'reward' | 'effect';
  type: string;
  value: string;
  quantity?: number;
  index: number;
};

const humanize = (value: string) => value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

export const DIALOG_ACTION_CATALOG: DialogActionCatalogEntry[] = [
  { id: 'reward:xp', group: 'reward', type: 'xp', label: 'XP', flareKey: 'reward_xp', description: 'Give experience.' },
  { id: 'reward:gold', group: 'reward', type: 'gold', label: 'Currency', flareKey: 'reward_currency', description: 'Give currency.' },
  { id: 'reward:item', group: 'reward', type: 'item', label: 'Give item', flareKey: 'reward_item', description: 'Give an item.' },
  { id: 'reward:remove_gold', group: 'reward', type: 'remove_gold', label: 'Take currency', flareKey: 'remove_currency', description: 'Take currency.' },
  { id: 'reward:remove_item', group: 'reward', type: 'remove_item', label: 'Take item', flareKey: 'remove_item', description: 'Take an item.' },
  { id: 'reward:restore', group: 'reward', type: 'restore', label: 'Restore', flareKey: 'restore', description: 'Restore HP, MP, or both.' },
  { id: 'reward:loot', group: 'reward', type: 'loot', label: 'Loot', flareKey: 'reward_loot', description: 'Drop loot.' },
  { id: 'reward:msg', group: 'reward', type: 'msg', label: 'Message', flareKey: 'msg', description: 'Show a message.' },
  { id: 'effect:set_status', group: 'effect', type: 'set_status', label: 'Set status', flareKey: 'set_status', description: 'Set a status.' },
  { id: 'effect:unset_status', group: 'effect', type: 'unset_status', label: 'Clear status', flareKey: 'unset_status', description: 'Clear a status.' },
  { id: 'effect:random_status', group: 'effect', type: 'random_status', label: 'Random status', flareKey: 'random_status', description: 'Set or clear a random status.' },
  { id: 'effect:teleport', group: 'effect', type: 'teleport', label: 'Teleport', flareKey: 'teleport', description: 'Teleport to a map.' },
  { id: 'effect:intramap', group: 'effect', type: 'intramap', label: 'Move in map', flareKey: 'intramap', description: 'Teleport inside this map.' },
  { id: 'effect:intermap_random', group: 'effect', type: 'intermap_random', label: 'Random map', flareKey: 'intermap_random', description: 'Teleport to a random map.' },
  { id: 'effect:spawn', group: 'effect', type: 'spawn', label: 'Spawn enemy', flareKey: 'spawn', description: 'Spawn an enemy.' },
  { id: 'effect:cutscene', group: 'effect', type: 'cutscene', label: 'Cutscene', flareKey: 'cutscene', description: 'Play a cutscene.' },
  { id: 'effect:sound', group: 'effect', type: 'sound', label: 'Sound', flareKey: 'sound', description: 'Play a sound.' },
  { id: 'effect:music', group: 'effect', type: 'music', label: 'Music', flareKey: 'music', description: 'Change music.' },
  { id: 'effect:npc', group: 'effect', type: 'npc', label: 'NPC dialog', flareKey: 'npc', description: 'Open another NPC dialog.' },
  { id: 'effect:stash', group: 'effect', type: 'stash', label: 'Open stash', flareKey: 'stash', description: 'Open the stash.' },
  { id: 'effect:book', group: 'effect', type: 'book', label: 'Open book', flareKey: 'book', description: 'Open a book.' },
  { id: 'effect:respec', group: 'effect', type: 'respec', label: 'Respec', flareKey: 'respec', description: 'Respec the hero.' },
  { id: 'effect:save_game', group: 'effect', type: 'save_game', label: 'Save game', flareKey: 'save_game', description: 'Save the game.' },
  { id: 'effect:script', group: 'effect', type: 'script', label: 'Script', flareKey: 'script', description: 'Run a script.' },
  { id: 'effect:loot', group: 'effect', type: 'loot', label: 'Drop loot', flareKey: 'loot', description: 'Drop loot.' },
  { id: 'effect:shakycam', group: 'effect', type: 'shakycam', label: 'Shake camera', flareKey: 'shakycam', description: 'Shake the camera.' },
  { id: 'effect:power', group: 'effect', type: 'power', label: 'Cast power', flareKey: 'power', description: 'Cast a power.' },
];

export function filterActionCatalog(query: string): DialogActionCatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return DIALOG_ACTION_CATALOG.slice();
  return DIALOG_ACTION_CATALOG.filter((entry) => {
    const hay = `${entry.label} ${entry.flareKey} ${entry.description} ${entry.type}`.toLowerCase();
    return hay.includes(q) || q.split(/\s+/).every((part) => hay.includes(part));
  });
}

export function chipsFromActions(rewards: DialogueReward[] = [], effects: DialogueWorldEffect[] = []): DialogActionChip[] {
  const chips: DialogActionChip[] = [];
  rewards.forEach((reward, index) => {
    chips.push({
      id: reward.id || `reward-${index}`,
      group: 'reward',
      type: reward.type,
      value: reward.value || '',
      quantity: reward.quantity,
      index,
    });
  });
  effects.forEach((effect, index) => {
    chips.push({
      id: effect.id || `effect-${index}`,
      group: 'effect',
      type: effect.type,
      value: effect.value || '',
      index,
    });
  });
  return chips;
}

export function actionChipLabel(chip: DialogActionChip, itemName?: (id: string) => string): string {
  const value = (chip.value || '').trim();
  const name = chip.type.includes('item') ? (itemName?.(value) || value || 'item') : value;
  const qty = chip.quantity && chip.quantity > 1 ? ` ×${chip.quantity}` : '';
  switch (chip.type) {
    case 'xp':
      return value ? `+${value} XP` : 'XP';
    case 'gold':
      return value ? `+${value} Gold` : 'Gold';
    case 'remove_gold':
      return value ? `−${value} Gold` : 'Take gold';
    case 'item':
      return `Gives ${name}${qty}`;
    case 'remove_item':
      return `Takes ${name}${qty}`;
    case 'restore':
      return value ? `Restores ${humanize(value)}` : 'Restore';
    case 'loot':
      return value ? `Loot ${humanize(value)}` : 'Loot';
    case 'msg':
      return value ? `Message: ${value}` : 'Message';
    case 'set_status':
      return value ? `Sets ${humanize(value)}` : 'Set status';
    case 'unset_status':
      return value ? `Clears ${humanize(value)}` : 'Clear status';
    case 'random_status':
      return value ? `Random: ${humanize(value)}` : 'Random status';
    case 'teleport':
    case 'intermap_random':
    case 'intermap_id':
      return value ? `Teleports to ${humanize(value)}` : 'Teleports to …';
    case 'intramap':
      return value ? `Moves to ${value}` : 'Move in map';
    default: {
      const entry = DIALOG_ACTION_CATALOG.find((item) => item.type === chip.type && item.group === chip.group);
      const label = entry?.label || humanize(chip.type);
      return value ? `${label}: ${humanize(value)}` : label;
    }
  }
}

export function actionChipTooltip(chip: DialogActionChip): string {
  const entry = DIALOG_ACTION_CATALOG.find((item) => item.type === chip.type && item.group === chip.group);
  const key = entry?.flareKey || chip.type;
  const qty = chip.quantity && chip.quantity > 1 ? `:${chip.quantity}` : '';
  return `${key}=${chip.value}${qty}`;
}
