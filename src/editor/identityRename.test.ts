import { describe, expect, it } from 'vitest';
import {
  applyIdentityRename,
  canonicalIdentity,
  displayIdentity,
  validateIdentity,
  validateRename,
} from './identityRename';

const files = {
  'maps/town.txt': `[event]
intermap=maps/cave.txt,4,6
requires_status=quest_open
requires_item=12
set_status=quest_done

[npc]
type=npc
filename=npcs/merchant.txt

[enemy]
filename=enemies/base/antlion.txt
`,
  'npcs/merchant.txt': `[dialog]
id=quest_krolan_turnin
him=Done
reward_item=12
set_status=quest_done
`,
  'quests/krolan.txt': `[quest]
name=Help
complete_status=quest_done
`,
  'items/items.txt': '[item]\nid=12\nname=Key\n[item]\nid=13\nname=Gem\n',
  'enemies/base/antlion.txt': 'INCLUDE enemies/base/core.txt\nname=Antlion\n',
  'maps/cave.txt': '[header]\ntitle=Cave\n',
  'quests/rescue.txt': '[quest]\nname=Rescue\n',
  'npcs/guard.txt': 'name=Guard\n',
  'enemies/base/core.txt': 'name=Core\n',
  'powers/melee.txt': '[power]\nid=1\nrequires_status=quest_open\n',
};

describe('identityRename', () => {
  it('rejects empty, unsafe, unchanged and colliding ids for every kind', () => {
    const cases: Array<{ kind: 'item' | 'quest' | 'flag' | 'npc' | 'enemy' | 'map'; from: string; bad: string[]; collide: string }> = [
      { kind: 'item', from: '12', bad: ['', '0', '01', '12a', '1.5'], collide: '13' },
      { kind: 'quest', from: 'krolan', bad: ['', 'has space', 'krolan/../x', 'ok.txt!'], collide: 'rescue' },
      { kind: 'flag', from: 'quest_open', bad: ['', 'has space', '1flag', 'quest-open'], collide: 'quest_done' },
      { kind: 'npc', from: 'merchant', bad: ['', 'has space', '../x'], collide: 'guard' },
      { kind: 'enemy', from: 'enemies/base/antlion.txt', bad: ['', 'has space', '../x'], collide: 'base/core' },
      { kind: 'map', from: 'cave', bad: ['', 'has space', 'cave/../town'], collide: 'town' },
    ];
    for (const entry of cases) {
      expect(validateIdentity(entry.kind, '').ok).toBe(false);
      for (const bad of entry.bad) {
        const result = validateRename(files, entry.kind, entry.from, bad);
        expect(result.ok, `${entry.kind} should reject ${JSON.stringify(bad)}`).toBe(false);
      }
      const clash = validateRename(files, entry.kind, entry.from, entry.collide);
      expect(clash.ok, `${entry.kind} should reject collision ${entry.collide}`).toBe(false);
      expect(clash.error).toMatch(/already/i);
    }
    // unchanged current id is a collision or "already the current id"
    expect(validateRename(files, 'item', '12', '12').ok).toBe(false);
    expect(validateRename(files, 'map', 'cave', 'maps/cave.txt').ok).toBe(false);
  });

  it('renames an item id and counts its references', () => {
    const check = validateRename(files, 'item', '12', '50');
    expect(check.ok).toBe(true);
    expect(check.usageCount).toBeGreaterThan(0);
    const next = applyIdentityRename(files, 'item', '12', check.nextId);
    expect(next.files['items/items.txt']).toContain('id=50');
    expect(next.files['maps/town.txt']).toContain('requires_item=50');
    expect(next.files['npcs/merchant.txt']).toContain('reward_item=50');
    expect(next.files['items/items.txt']).toContain('id=13');
    expect(next.moves).toEqual([]);
  });

  it('renames a quest file, turn-in dialog id, and leaves other quest text intact', () => {
    const check = validateRename(files, 'quest', 'krolan', 'missing_key');
    expect(check.ok).toBe(true);
    expect(canonicalIdentity('quest', check.nextId)).toBe('quests/missing_key.txt');
    const next = applyIdentityRename(files, 'quest', 'krolan', 'missing_key');
    expect(next.files['quests/missing_key.txt']).toContain('name=Help');
    expect(next.files['quests/krolan.txt']).toBeUndefined();
    expect(next.files['npcs/merchant.txt']).toContain('id=quest_missing_key_turnin');
    expect(next.moves).toEqual([
      { from: 'quests/krolan.txt', to: 'quests/missing_key.txt' },
      { from: 'content/quests/krolan.json', to: 'content/quests/missing_key.json', optional: true },
    ]);
  });

  it('renames a Story Flag across requires_status and leaves comments-free other keys', () => {
    const check = validateRename(files, 'flag', 'quest_open', 'gate_open');
    expect(check.ok).toBe(true);
    const next = applyIdentityRename(files, 'flag', 'quest_open', 'gate_open');
    expect(next.files['maps/town.txt']).toContain('requires_status=gate_open');
    expect(next.files['powers/melee.txt']).toContain('requires_status=gate_open');
    expect(next.files['maps/town.txt']).toContain('set_status=quest_done');
  });

  it('renames NPC, enemy and map files and their references', () => {
    const npc = applyIdentityRename(files, 'npc', 'merchant', 'shopkeep');
    expect(npc.files['maps/town.txt']).toContain('filename=npcs/shopkeep.txt');
    expect(npc.files['npcs/shopkeep.txt']).toContain('id=quest_krolan_turnin');
    expect(npc.files['npcs/merchant.txt']).toBeUndefined();

    const enemy = applyIdentityRename(files, 'enemy', 'enemies/base/antlion.txt', 'base/beetle');
    expect(enemy.files['maps/town.txt']).toContain('filename=enemies/base/beetle.txt');
    expect(enemy.files['enemies/base/beetle.txt']).toContain('INCLUDE enemies/base/core.txt');
    expect(displayIdentity('enemy', 'enemies/base/beetle.txt')).toBe('base/beetle');

    const map = applyIdentityRename(files, 'map', 'cave', 'den');
    expect(map.files['maps/town.txt']).toContain('intermap=maps/den.txt,4,6');
    expect(map.files['maps/den.txt']).toContain('title=Cave');
    expect(map.files['maps/cave.txt']).toBeUndefined();
    expect(map.moves.some((m) => m.from === 'cave.json' && m.to === 'den.json' && m.optional)).toBe(true);
  });
});
