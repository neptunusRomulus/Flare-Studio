import { describe, expect, it } from 'vitest';
import { npcFileUpdate, npcFileContent, npcFileBase, isStudioNpcAnimation } from './npcFileUpdate';

const existing = 'name=Old\nanimations=animations/npcs/guill.txt\nvendor=true\nconstant_stock=1,2\nconstant_stock=3\nvox_intro=a.ogg\nvendor_ratio_buy=2\n\n[stats]\nspeed=2\n\n[dialog]\nid=a\nher=Hi\nset_status=x\nyou=Bye\n';

describe('NPC save merge', () => {
  it('only fields the object holds override the file', () => {
    const u = npcFileUpdate('Guill', { vox_intro: 'b.ogg, c.ogg', show_on_minimap: 'false' }, {});
    expect(u.fields).toEqual({ name: 'Guill', vox_intro: 'b.ogg\nc.ogg', show_on_minimap: 'false' });
    const out = npcFileContent(existing, u);
    expect(out).toContain('name=Guill\nanimations=animations/npcs/guill.txt\nvendor=true\nconstant_stock=1,2\nconstant_stock=3\nvox_intro=b.ogg\nvox_intro=c.ogg\nvendor_ratio_buy=2\nshow_on_minimap=false');
    expect(out).toContain('[stats]\nspeed=2');
    expect(out).toContain('[dialog]\nid=a\nher=Hi\nset_status=x\nyou=Bye');
  });
  it('vendor off and cleared stock remove the keys', () => {
    const out = npcFileContent(existing, npcFileUpdate('Old', { vendor: 'false', constant_stock: '' }, {}));
    expect(out).not.toContain('vendor=true');
    expect(out).not.toContain('constant_stock');
  });
  it('dialog edits from Studio keep the file order', () => {
    const trees = [{ dialogueId: 'a', topic: '', responses: [], requirements: [], rewards: [], worldEffects: [{ type: 'set_status', value: 'x' }], dialogues: [{ speaker: 'npc', text: 'Hello' }, { speaker: 'player', text: 'Bye' }] }];
    const out = npcFileContent(existing, npcFileUpdate('Old', { dialogueTrees: JSON.stringify(trees) }, {}));
    // set_status stays between the lines (Studio's list is authoritative; the file gives the order)
    expect(out).toContain('[dialog]\nid=a\nhim=Hello\nset_status=x\nyou=Bye');
  });
  it('new NPC without a file', () => {
    const out = npcFileContent(null, npcFileUpdate('New', { talker: 'true' }, { animations: 'animations/npcs/new.txt' }));
    expect(out).toBe('name=New\ntalker=true\nanimations=animations/npcs/new.txt\n');
  });
  it('helpers', () => {
    expect(npcFileBase('npcs/guill.txt')).toBe('guill.txt');
    expect(isStudioNpcAnimation('image=images/npcs/a.png\n\n[stance]\n', 'a.png')).toBe(true);
    expect(isStudioNpcAnimation('# hand made\nimage=images/npcs/b.png\n', 'a.png')).toBe(false);
  });
});
