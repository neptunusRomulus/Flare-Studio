import { describe, expect, it } from 'vitest';
import { findUsages, formatUsageList, pathsMatch, renameRefs } from './projectRefs';

const files = {
  'maps/town.txt': `# town
[header]
title=Town

[event]
type=event
intermap=maps/cave.txt,4,6
requires_status=quest_open
requires_item=10,11
reward_item=12:1
loot=13,80,1,1
set_status=quest_done

[npc]
type=npc
filename=npcs/merchant.txt
location=1,1,1,1

[enemy]
category=antlion
filename=enemies/base/antlion.txt
`,
  'npcs/merchant.txt': `# shop
name=Merchant
[dialog]
id=quest_krolan_turnin
him=Done
reward_item=12
set_status=quest_done
requires_not_status=quest_done
status_stock=default,12:3,99:1
`,
  'quests/krolan.txt': `[quest]
name=Help
complete_status=quest_done
`,
  'loot/chest.txt': `[loot]
id=12
chance=10
`,
  'enemies/base/antlion.txt': `INCLUDE enemies/base/core.txt
name=Antlion
`,
  'powers/melee.txt': `[power]
id=1
requires_item=10
requires_status=quest_open
`,
};

describe('projectRefs', () => {
  it('finds item usages without matching 10 inside 100 or 110', () => {
    const extra = { ...files, 'items/items.txt': '[item]\nid=100\nrequires_item=110,10\n' };
    const hits = findUsages(extra, 'item', '10');
    expect(hits.map((h) => `${h.path}:${h.key}`).sort()).toEqual([
      'items/items.txt:requires_item',
      'maps/town.txt:requires_item',
      'powers/melee.txt:requires_item',
    ]);
    expect(findUsages(extra, 'item', '12').some((h) => h.key === 'status_stock')).toBe(true);
    expect(findUsages(extra, 'item', '12').some((h) => h.path === 'loot/chest.txt' && h.key === 'id')).toBe(true);
  });

  it('renames an item id in lists, loot shorthand, vendor stock and loot tables', () => {
    const next = renameRefs(files, 'item', '12', '50');
    expect(next['maps/town.txt']).toContain('reward_item=50:1');
    expect(next['maps/town.txt']).not.toContain('reward_item=12');
    expect(next['npcs/merchant.txt']).toContain('reward_item=50');
    expect(next['npcs/merchant.txt']).toContain('status_stock=default,50:3,99:1');
    expect(next['loot/chest.txt']).toContain('id=50');
    expect(next['maps/town.txt']).toContain('requires_item=10,11');
    expect(next['powers/melee.txt']).toBe(files['powers/melee.txt']);
  });

  it('finds and renames NPC, map, enemy and flag references, leaving comments alone', () => {
    expect(pathsMatch('npcs/merchant.txt', 'merchant', 'npc')).toBe(true);
    expect(findUsages(files, 'npc', 'merchant').map((h) => h.path)).toEqual(['maps/town.txt']);
    expect(findUsages(files, 'map', 'maps/cave.txt')[0].key).toBe('intermap');
    expect(findUsages(files, 'enemy', 'enemies/base/antlion.txt')[0].key).toBe('filename');
    expect(findUsages(files, 'flag', 'quest_done').length).toBeGreaterThan(1);

    const npc = renameRefs(files, 'npc', 'npcs/merchant.txt', 'npcs/shopkeep.txt');
    expect(npc['maps/town.txt']).toContain('filename=npcs/shopkeep.txt');
    expect(npc['maps/town.txt']).toContain('# town');

    const map = renameRefs(files, 'map', 'cave', 'den');
    expect(map['maps/town.txt']).toContain('intermap=maps/den.txt,4,6');

    const flag = renameRefs(files, 'flag', 'quest_done', 'krolan_done');
    expect(flag['quests/krolan.txt']).toContain('complete_status=krolan_done');
    expect(flag['npcs/merchant.txt']).toContain('set_status=krolan_done');
    expect(flag['npcs/merchant.txt']).toContain('requires_not_status=krolan_done');

    const enemy = renameRefs(files, 'enemy', 'enemies/base/antlion.txt', 'enemies/base/beetle.txt');
    expect(enemy['maps/town.txt']).toContain('filename=enemies/base/beetle.txt');
    expect(enemy['maps/town.txt']).toContain('category=antlion');
  });

  it('renames INCLUDE paths and formats a short usage list', () => {
    const next = renameRefs(files, 'enemy', 'enemies/base/core.txt', 'enemies/base/stats.txt');
    expect(next['enemies/base/antlion.txt']).toContain('INCLUDE enemies/base/stats.txt');
    const usages = findUsages(files, 'item', '12');
    const msg = formatUsageList(usages, 2);
    expect(msg).toContain('reward_item=12');
    expect(msg).toMatch(/and \d+ more/);
  });

  it('does nothing when ids are empty or unchanged', () => {
    expect(renameRefs(files, 'item', '12', '12')).toBe(files);
    expect(findUsages(files, 'item', '')).toEqual([]);
  });
});
