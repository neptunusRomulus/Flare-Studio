import { describe, expect, it } from 'vitest';
import { npcFileUpdate, npcFileContent, npcFileBase, isStudioNpcAnimation } from './npcFileUpdate';
import { parseVendorTabs, formatVendorTabs, sectionsFromNpcText } from './npcFileUpdate';
import { mergeNpcFile } from '@/adapters/flare/flareAdapter.cjs';

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

describe('vendor fields', () => {
  it('writes ratios, craft stock, tabs and gamble flags; repeatable keys one line each', () => {
    const out = npcFileContent('name=V\nvendor=true\nvendor_ratio_buy=2\ncraft_random_stock=loot/a.txt\n', npcFileUpdate('V', {
      vendor: 'true', vendor_ratio_buy: '', vendor_ratio_sell: '0.5',
      craft_constant_stock: '1001,1002', craft_status_stock: 's1,1003\ns2,1004',
      craft_random_stock_count: '1,3', vendor_tab_enabled: formatVendorTabs({ buy: true, sell: false, craft: true }),
      vendor_gamble_buy: 'true', vendor_gamble_craft: '',
    }, {}));
    expect(out).not.toContain('vendor_ratio_buy');
    expect(out).toContain('craft_random_stock=loot/a.txt');
    expect(out).toContain('vendor_ratio_sell=0.5');
    expect(out).toContain('craft_status_stock=s1,1003\ncraft_status_stock=s2,1004');
    expect(out).toContain('vendor_tab_enabled=sell,false\nvendor_tab_enabled=craft,true');
    expect(out).toContain('vendor_gamble_buy=true');
    expect(out).not.toContain('vendor_gamble_craft');
  });
  it('vendor tabs parse with engine defaults', () => {
    expect(parseVendorTabs('')).toEqual({ buy: true, sell: true, craft: false });
    expect(parseVendorTabs('craft,true\nbuy,false')).toEqual({ buy: false, sell: true, craft: true });
    expect(formatVendorTabs({ buy: true, sell: true, craft: false })).toBe('');
  });
});

describe('NPC sections', () => {
  const file = 'name=A\n\n[stats]\n# keep\nspeed=2\nstat=hp,10\n\n[visual_effect]\nid=glow\nanimation=a.txt\n\n[visual_effect]\nid=old\nanimation=b.txt\n\n[dialog]\nid=d\nhim=Hi\n';
  it('reads sections from a file', () => {
    expect(sectionsFromNpcText(file, 'visual_effect').map(s => s[0].value)).toEqual(['glow', 'old']);
    expect(sectionsFromNpcText(file, 'stats')).toEqual([[{ key: 'speed', value: '2' }, { key: 'stat', value: 'hp,10' }]]);
  });
  it('a present property replaces the sections in place; comments stay; absent keeps the file', () => {
    const out = npcFileContent(file, npcFileUpdate('A', {
      npc_stats: JSON.stringify([[{ key: 'speed', value: '3' }, { key: 'stat', value: 'hp,10' }, { key: 'stat', value: 'mp,5' }]]),
      npc_visual_effects: JSON.stringify([[{ key: 'id', value: 'glow' }, { key: 'animation', value: 'a.txt' }, { key: 'automatic', value: 'true' }]]),
    }, {}));
    expect(out).toBe('name=A\n\n[stats]\n# keep\nspeed=3\nstat=hp,10\nstat=mp,5\n\n[visual_effect]\nid=glow\nanimation=a.txt\nautomatic=true\n\n[dialog]\nid=d\nhim=Hi\n');
    expect(npcFileContent(file, npcFileUpdate('A', {}, {}))).toContain('id=old');
  });
});

describe('dialog polish', () => {
  it('writes her lines, per-line portrait keys and allow_movement', () => {
    const trees = [{ id: '1', dialogueId: 'd', topic: 'T', responses: [], requirements: [], rewards: [], worldEffects: [],
      passthrough: [{ key: 'allow_movement', value: 'false' }],
      dialogues: [
        { id: 'a', speaker: 'npc', key: 'her', text: 'Hi', portrait: 'images/p.png', portraitKey: 'portrait_her' },
        { id: 'b', speaker: 'npc', text: 'Look', portrait: 'images/me.png', portraitKey: 'portrait_you' },
        { id: 'c', speaker: 'player', text: 'Ok' },
      ] }];
    const out = npcFileContent(null, npcFileUpdate('N', { talker: 'true', dialogueTrees: JSON.stringify(trees) }, {}));
    expect(out).toContain('portrait_her=images/p.png\nher=Hi\nportrait_you=images/me.png\nhim=Look\nyou=Ok\nallow_movement=false');
  });
});

describe('INCLUDE merge', () => {
  it('rewrites INCLUDE paths and keeps comments around them', () => {
    const existing = '# note\nINCLUDE npcs/base/a.txt\nname=Guard\nINCLUDE npcs/base/b.txt\n';
    const text = mergeNpcFile(existing, { fields: { name: 'Guard' }, includes: ['npcs/base/a.txt', 'npcs/base/c.txt'] });
    expect(text).toContain('# note');
    expect(text).toContain('INCLUDE npcs/base/a.txt');
    expect(text).toContain('INCLUDE npcs/base/c.txt');
    expect(text).not.toContain('INCLUDE npcs/base/b.txt');
    expect(text.indexOf('# note')).toBeLessThan(text.indexOf('INCLUDE npcs/base/a.txt'));
  });

  it('can add the first INCLUDE and remove all of them', () => {
    const added = mergeNpcFile('name=Guard\n', { fields: { name: 'Guard' }, includes: ['npcs/base/x.txt'] });
    expect(added).toContain('INCLUDE npcs/base/x.txt');
    const cleared = mergeNpcFile(added, { fields: { name: 'Guard' }, includes: [] });
    expect(cleared).not.toContain('INCLUDE');
  });
});

describe('dialog event keys', () => {
  it('keeps random_status and other dialog component keys on merge', () => {
    const existing = '[dialog]\nid=a\nhim=Hi\nrandom_status=clear\nrandom_status=append,foo\nrepeat=true\n';
    const trees = [
      {
        dialogueId: 'a',
        dialogues: [{ speaker: 'npc', text: 'Hi' }],
        worldEffects: [
          { type: 'random_status', value: 'clear' },
          { type: 'random_status', value: 'append,foo' },
          { type: 'repeat', value: 'true' },
          { type: 'shakycam', value: '500ms' },
        ],
        components: [],
      },
    ];
    const out = mergeNpcFile(existing, { fields: { name: 'X' }, dialogueTrees: trees });
    expect(out).toContain('random_status=clear');
    expect(out).toContain('random_status=append,foo');
    expect(out).toContain('repeat=true');
    expect(out).toContain('shakycam=500ms');
  });
});
