import { describe, expect, it } from 'vitest';
import {
  preservedDir,
  slugFromDisplayName,
  uniqueSlugFromName,
} from './identityFromName';

const files = {
  'maps/town.txt': '[header]\ntitle=Town\n',
  'maps/forest_path.txt': '[header]\ntitle=Forest Path\n',
  'npcs/merchant.txt': 'name=Merchant\n',
  'npcs/guard.txt': 'name=Guard\n',
  'quests/krolan.txt': '[quest]\nname=Help Krolan\n',
  'enemies/goblin.txt': 'name=Goblin\n',
  'enemies/base/antlion.txt': 'name=Antlion\n',
  'powers/melee.txt': '[power]\nid=1\nrequires_status=quest_open,2nd_done\nset_status=quest_done\n',
};

describe('identityFromName', () => {
  it('folds Turkish letters through the shared slug', () => {
    expect(slugFromDisplayName('npc', 'Işık')).toBe('isik');
    expect(slugFromDisplayName('quest', 'Görev Şövalyesi')).toBe('gorev_sovalyesi');
    expect(slugFromDisplayName('enemy', '  Goblin Warrior  ')).toBe('goblin_warrior');
  });

  it('prefixes a Story Flag slug that would start with a digit', () => {
    expect(slugFromDisplayName('flag', '2nd wave')).toBe('_2nd_wave');
    expect(slugFromDisplayName('flag', 'Quest Done')).toBe('quest_done');
  });

  it('does not slug item ids', () => {
    expect(slugFromDisplayName('item', 'Iron Sword')).toBe('');
  });

  it('keeps an enemy in its current folder', () => {
    expect(preservedDir('enemy', 'enemies/base/antlion.txt')).toBe('base/');
    expect(preservedDir('enemy', 'goblin')).toBe('');
    expect(preservedDir('npc', 'npcs/merchant.txt')).toBe('');
  });

  it('appends _2, _3 when the slugged name is already used', () => {
    expect(uniqueSlugFromName(files, 'npc', 'Merchant')).toBe('merchant_2');
    expect(uniqueSlugFromName(files, 'npc', 'Merchant', 'npcs/merchant.txt')).toBe('merchant');
    expect(uniqueSlugFromName(files, 'map', 'Forest Path', 'forest_path')).toBe('forest_path');
    expect(uniqueSlugFromName(files, 'map', 'Town')).toBe('town_2');
    expect(uniqueSlugFromName(files, 'quest', 'Help Krolan', 'krolan')).toBe('help_krolan');
    expect(uniqueSlugFromName(files, 'enemy', 'Goblin')).toBe('goblin_2');
    expect(uniqueSlugFromName(files, 'enemy', 'Antlion Guard', 'enemies/base/antlion.txt')).toBe('base/antlion_guard');
  });

  it('walks past more than one collision', () => {
    const crowded = { ...files, 'npcs/merchant_2.txt': 'name=Merchant\n' };
    expect(uniqueSlugFromName(crowded, 'npc', 'Merchant')).toBe('merchant_3');
  });
});
