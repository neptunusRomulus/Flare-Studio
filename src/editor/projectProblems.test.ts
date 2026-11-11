import { describe, expect, it } from 'vitest';
import { findProjectProblems } from './projectProblems';

const files = {
  'maps/town.txt': `[event]
intermap=maps/missing.txt,1,1
loot=99,80,1,1
book=books/lost.txt
reward_item=4
quest=krolan
`,
  'maps/cave.txt': '[header]\ntitle=Cave\n',
  'npcs/shop.txt': 'status_stock=default,4:1,88:2\n',
  'engine/classes.txt': `[class]
name=Brute
equipment=4,9
powers=7
actionbar=0,7,15
`,
  'items/items.txt': '[item]\nid=4\nname=Sword\n',
  'powers/powers.txt': '[power]\nid=7\nname=Strike\n',
  'loot/chest.txt': '[loot]\nid=4\n',
  'quests/krolan.txt': '[quest]\nname=Help\n',
};

describe('findProjectProblems', () => {
  it('lists broken intermap, loot item, vendor stock, class, book, item and keeps good quest refs', () => {
    const problems = findProjectProblems(files);
    const byKind = (k: string) => problems.filter((p) => p.kind === k).map((p) => p.message);
    expect(byKind('intermap').some((m) => m.includes('missing.txt'))).toBe(true);
    expect(byKind('loot').some((m) => m.includes('99'))).toBe(true);
    expect(byKind('vendor').some((m) => m.includes('88'))).toBe(true);
    expect(byKind('class').some((m) => m.includes('item 9'))).toBe(true);
    expect(byKind('class').some((m) => m.includes('power 15'))).toBe(true);
    expect(byKind('class').some((m) => m.includes('power 7'))).toBe(false);
    expect(byKind('book').some((m) => m.includes('lost.txt'))).toBe(true);
    expect(byKind('item').some((m) => m.includes('item 4'))).toBe(false);
    expect(byKind('quest')).toEqual([]);
    const brokenQuest = findProjectProblems({ ...files, 'maps/town.txt': files['maps/town.txt'].replace('quest=krolan', 'quest=ghost') });
    expect(brokenQuest.some((p) => p.kind === 'quest' && p.message.includes('ghost'))).toBe(true);
  });
});
