import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { importNpcText, exportNpcFile, mergeNpcFile } = require('./serializers.cjs');

const FIXTURES = path.resolve(__dirname, '../../../tests/fixtures/flare-npcs');

/** Canonical form: INCLUDE lines, main section in order, other sections in order of name, dialogs in order. */
function canon(text: string) {
  const blocks: Array<{ name: string; lines: string[] }> = [{ name: '', lines: [] }];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^\[([^\]]+)\]$/);
    if (m) { blocks.push({ name: m[1], lines: [] }); continue; }
    blocks[blocks.length - 1].lines.push(line);
  }
  const main = blocks[0];
  const dialogs = blocks.filter(b => b.name === 'dialog');
  const other = blocks.filter((b, i) => i > 0 && b.name !== 'dialog' && b.name !== 'npc').sort((a, b) => a.name.localeCompare(b.name));
  const npcSection = blocks.filter(b => b.name === 'npc').flatMap(b => b.lines);
  return { main: [...main.lines, ...npcSection], other, dialogs };
}

const files = fs.readdirSync(FIXTURES).filter(f => f.endsWith('.txt'));
const lines = (t: string) => t.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

describe('NPC file round trip (flare-game samples)', () => {
  const withLf = (text: string) => {
    const t = text.replace(/\r/g, '');
    return t.endsWith('\n') ? t : `${t}\n`;
  };

  it.each(files)('%s survives import + export byte-for-byte, including blank lines', (file) => {
    const text = withLf(fs.readFileSync(path.join(FIXTURES, file), 'utf8'));
    const out = exportNpcFile(importNpcText(text));
    expect(canon(out)).toEqual(canon(text));
    expect(lines(out)).toEqual(lines(text));
    expect(out).toBe(text);
  });

  it.each(files)('%s merge with no field changes is byte-identical', (file) => {
    const text = withLf(fs.readFileSync(path.join(FIXTURES, file), 'utf8'));
    expect(mergeNpcFile(text, {})).toBe(text);
  });

  it('merging unchanged Studio fields keeps the file as is', () => {
    const text = fs.readFileSync(path.join(FIXTURES, 'studio_edge.txt'), 'utf8');
    const merged = mergeNpcFile(text, { fields: { name: 'Edge Case', talker: true, vendor: true } });
    expect(canon(merged)).toEqual(canon(text));
  });

  it('merging a change rewrites only that key; empty removes it', () => {
    const text = fs.readFileSync(path.join(FIXTURES, 'studio_edge.txt'), 'utf8');
    const merged = mergeNpcFile(text, { fields: { name: 'Renamed', vox_intro: 'soundfx/npcs/c.ogg', show_on_minimap: '' } });
    const c = canon(merged);
    expect(c.main[1]).toBe('name=Renamed');
    expect(c.main.filter((l: string) => l.startsWith('vox_intro='))).toEqual(['vox_intro=soundfx/npcs/c.ogg']);
    expect(c.main.some((l: string) => l.startsWith('show_on_minimap'))).toBe(false);
    expect(c.main.filter((l: string) => l.startsWith('constant_stock='))).toEqual(['constant_stock=1,2,3', 'constant_stock=4:2,5']);
    expect(c.other.map((s: { name: string }) => s.name)).toEqual(['stats', 'visual_effect']);
    expect(merged.startsWith('INCLUDE npcs/base/guard.txt\n')).toBe(true);
  });

  it('edited dialog keeps component order, her and per-line portraits', () => {
    const text = fs.readFileSync(path.join(FIXTURES, 'studio_edge.txt'), 'utf8');
    const npc = importNpcText(text);
    const tree = npc.customProperties.dialogueTrees[0];
    expect(tree.dialogues[0]).toMatchObject({ speaker: 'npc', key: 'her', portraitKey: 'portrait_her' });
    // Studio-side edit: change one line text; trees come without components (merge re-attaches by id)
    const edited = { ...tree, components: undefined, dialogues: tree.dialogues.map((d: { text: string }, i: number) => i === 1 ? { ...d, text: 'Hello!' } : d) };
    const out = canon(mergeNpcFile(text, { dialogueTrees: [edited] })).dialogs[0].lines;
    const orig = canon(text).dialogs[0].lines;
    expect(out).toEqual(orig.map((l: string) => (l === 'you=Hi.' ? 'you=Hello!' : l)));
  });

  it('new trees without components get a sensible order', () => {
    const out = exportNpcFile({ name: 'N', customProperties: { dialogueTrees: [{ dialogueId: 'a', topic: 'T', requirements: [{ type: 'status', value: 's' }], responses: ['b'], dialogues: [{ speaker: 'npc', text: 'Hi' }], rewards: [], worldEffects: [{ type: 'set_status', value: 'x' }] }] } });
    expect(canon(out).dialogs[0].lines).toEqual(['id=a', 'topic=T', 'requires_status=s', 'response=b', 'him=Hi', 'set_status=x']);
  });

  it('Flare 1.15 dialog actions survive import + export in file order', () => {
    const text = [
      'name=Quest NPC',
      'talker=true',
      '',
      '[dialog]',
      'id=q1',
      'topic=Quest',
      'reward_loot=loot/chest.txt',
      'reward_loot_count=2,4',
      'intramap=5,6',
      'music=soundfx/music/village.ogg',
      'stash=true',
      'book=books/lore.txt',
      'respec=stats,true',
      'save_game=true',
      'script=events/reward.txt',
      'visual_effect=glow',
      'take_a_party=true',
      'him=Hello',
    ].join('\n');
    const npc = importNpcText(text);
    expect(lines(exportNpcFile(npc))).toEqual(lines(text));

    const tree = npc.customProperties.dialogueTrees[0];
    expect(tree.rewards).toContainEqual(expect.objectContaining({ type: 'loot', value: 'loot/chest.txt' }));
    expect(tree.worldEffects.map((e: { type: string }) => e.type)).toEqual([
      'intramap', 'music', 'stash', 'book', 'respec', 'save_game', 'script', 'visual_effect',
    ]);
    expect(tree.passthrough).toContainEqual({ key: 'reward_loot_count', value: '2,4' });
    expect(tree.passthrough).toContainEqual({ key: 'take_a_party', value: 'true' });
  });

  it('new loot and world actions get a sensible order', () => {
    const out = exportNpcFile({
      name: 'N',
      customProperties: {
        dialogueTrees: [{
          dialogueId: 'a',
          topic: 'T',
          dialogues: [{ speaker: 'npc', text: 'Hi' }],
          rewards: [{ type: 'loot', value: 'loot/x.txt' }],
          worldEffects: [{ type: 'intramap', value: '3,4' }, { type: 'stash', value: 'true' }],
        }],
      },
    });
    expect(canon(out).dialogs[0].lines).toEqual(['id=a', 'topic=T', 'him=Hi', 'intramap=3,4', 'stash=true', 'reward_loot=loot/x.txt']);
  });

  it('event-manager actions and tile requirements survive import + export', () => {
    const text = [
      'name=Event NPC',
      'talker=true',
      '',
      '[dialog]',
      'id=e1',
      'topic=Event',
      'requires_tile=background,3,4,12',
      'requires_not_tile=foreground,1,1,7',
      'intermap_id=mill_door',
      'intermap_random=maps/lists/caves.txt',
      'mapmod=background 3,4,12',
      'mapmod_toggle=foreground 1,1,7,8',
      'loot=loot/chest.txt',
      'loot_count=1,3',
      'shakycam=1.5',
      'chance_exec=50',
      'power=7',
      'power_path=2,3,hero',
      'power_damage=5,9',
      'power_stats=stats/spawner.txt',
      'power_level=hero_stat,1.2,will',
      'spawn_level=fixed,3',
      'spawn=goblin,4,5',
      'him=Boom',
    ].join('\n');
    const npc = importNpcText(text);
    expect(lines(exportNpcFile(npc))).toEqual(lines(text));

    const tree = npc.customProperties.dialogueTrees[0];
    expect(tree.requirements).toEqual([
      expect.objectContaining({ type: 'tile', value: 'background,3,4,12' }),
      expect.objectContaining({ type: 'not_tile', value: 'foreground,1,1,7' }),
    ]);
    expect(tree.worldEffects.map((e: { type: string }) => e.type)).toEqual([
      'intermap_id', 'intermap_random', 'mapmod', 'mapmod_toggle', 'loot', 'shakycam', 'chance_exec',
      'power', 'power_path', 'power_damage', 'power_stats', 'power_level', 'spawn_level', 'spawn',
    ]);
    expect(tree.passthrough).toContainEqual({ key: 'loot_count', value: '1,3' });
  });

  it('new event actions get a sensible order', () => {
    const out = exportNpcFile({
      name: 'N',
      customProperties: {
        dialogueTrees: [{
          dialogueId: 'a',
          topic: 'T',
          requirements: [{ type: 'tile', value: 'background,1,1,2' }],
          dialogues: [{ speaker: 'npc', text: 'Hi' }],
          worldEffects: [
            { type: 'shakycam', value: '2' },
            { type: 'mapmod', value: 'background 1,1,2' },
            { type: 'loot', value: 'loot/x.txt' },
          ],
        }],
      },
    });
    expect(canon(out).dialogs[0].lines).toEqual([
      'id=a', 'topic=T', 'requires_tile=background,1,1,2', 'him=Hi',
      'shakycam=2', 'mapmod=background 1,1,2', 'loot=loot/x.txt',
    ]);
  });
});

const { normalizeEnemyText, includesFromEnemyText, applyEnemyFileUpdates } = require('./serializers.cjs');

const ENEMY_FIXTURES = path.resolve(__dirname, '../../../tests/fixtures/flare-enemies');

describe('enemy preset save keeps INCLUDE and repeated keys', () => {
  const text = [
    'INCLUDE enemies/base/goblin.txt',
    'name=Goblin Chief',
    'categories=goblin,boss',
    'stat=hp,60',
    'stat=accuracy,80',
    'power=melee,164,10',
    'power=ranged,239,10',
    'sfx_attack=swing,soundfx/enemies/goblin_phys.ogg',
    'sfx_attack=cast,soundfx/enemies/goblin_ment.ogg',
    'some_future_key=1',
    'gold=5',
    '',
    '[render_layers]',
    'layer=0,body',
    'layer=head',
  ].join('\n');
  it('round-trips everything except non-StatBlock keys', () => {
    const { text: out, warnings } = normalizeEnemyText(text);
    expect(lines(out)).toEqual(lines(text).filter(l => l !== 'gold=5').map(l => (l === 'layer=head' ? 'layer=0,head' : l)));
    expect(warnings.join(' ')).toContain('gold');
  });
  it('fantasycore-style base enemy is unchanged', () => {
    const base = 'INCLUDE enemies/base/beacon.txt\n\nsfx_attack=swing,soundfx/enemies/zombie_phys.ogg\nsfx_attack=shoot,soundfx/enemies/zombie_phys.ogg\nanimations=animations/enemies/zombie.txt\n';
    expect(lines(normalizeEnemyText(base).text)).toEqual(lines(base));
  });
});


describe('enemy file blank-line round trip (flare-game samples)', () => {
  const files = fs.readdirSync(ENEMY_FIXTURES).filter((f: string) => f.endsWith('.txt'));
  const withLf = (text: string) => {
    const t = text.replace(/\r/g, '');
    return t.endsWith('\n') ? t : `${t}\n`;
  };
  it.each(files)('%s normalizeEnemyText is byte-identical, including inner blank lines', (file: string) => {
    const text = withLf(fs.readFileSync(path.join(ENEMY_FIXTURES, file), 'utf8'));
    const { text: out, warnings } = normalizeEnemyText(text);
    expect(warnings).toEqual([]);
    expect(out).toBe(text);
  });
});

describe('applyEnemyFileUpdates (Save as preset)', () => {
  const src = [
    'INCLUDE enemies/base/goblin.txt',
    'INCLUDE enemies/base/boss.txt',
    'name=Goblin Chief',
    'stat=hp,60',
    'stat=accuracy,80',
    'power=melee,164,10',
    'power=ranged,239,10',
    'sfx_attack=swing,soundfx/enemies/goblin_phys.ogg',
    'sfx_attack=cast,soundfx/enemies/goblin_ment.ogg',
    'some_future_key=1',
    '',
    '[render_layers]',
    'layer=0,body',
  ].join('\n');

  it('keeps multiple INCLUDE lines and repeated keys when unique fields change', () => {
    const { text: out } = applyEnemyFileUpdates(src, {
      includes: ['enemies/base/elite.txt', 'enemies/base/boss.txt'],
      fields: { name: 'Goblin King', level: '8' },
    });
    expect(includesFromEnemyText(out)).toEqual(['enemies/base/elite.txt', 'enemies/base/boss.txt']);
    expect(out).toContain('name=Goblin King');
    expect(out).toContain('level=8');
    expect(out).toContain('stat=hp,60');
    expect(out).toContain('stat=accuracy,80');
    expect(out).toContain('power=melee,164,10');
    expect(out).toContain('power=ranged,239,10');
    expect(out).toContain('sfx_attack=swing,soundfx/enemies/goblin_phys.ogg');
    expect(out).toContain('sfx_attack=cast,soundfx/enemies/goblin_ment.ogg');
    expect(out).toContain('some_future_key=1');
    expect(out).toContain('[render_layers]');
    expect(out).toContain('layer=0,body');
  });

  it('replaces repeated loot lines only when listFields.loot is set', () => {
    const withLoot = [
      'name=Scout',
      'loot=loot/chest_level_2.txt',
      'loot=91,1',
      'xp=10',
    ].join('\n');
    const untouched = applyEnemyFileUpdates(withLoot, { fields: { name: 'Scout' } }).text;
    expect(untouched).toContain('loot=loot/chest_level_2.txt');
    expect(untouched).toContain('loot=91,1');
    const edited = applyEnemyFileUpdates(withLoot, {
      fields: { name: 'Scout' },
      listFields: { loot: ['loot/chest_level_2.txt', '91,20'] },
    }).text;
    expect(edited).toContain('loot=loot/chest_level_2.txt');
    expect(edited).toContain('loot=91,20');
    expect(edited).not.toContain('loot=91,1');
    expect(edited).toContain('xp=10');
  });

  it('writes every INCLUDE when creating a new file from the form', () => {
    const { text: out } = applyEnemyFileUpdates('', {
      header: '# Enemy file generated by Flare Studio',
      includes: ['enemies/base/goblin.txt', 'enemies/base/boss.txt'],
      lines: ['name=Scout', 'level=2'],
    });
    expect(includesFromEnemyText(out)).toEqual(['enemies/base/goblin.txt', 'enemies/base/boss.txt']);
    expect(out).toContain('name=Scout');
    expect(out).toContain('level=2');
  });
});

describe('NPC comments', () => {
  it('merge keeps comments in place', () => {
    const text = '# header\nname=A\n# talk\ntalker=true\n\n[stats]\n# s\nspeed=2\n\n[dialog]\nid=x\n# c\nhim=Hi\n';
    const out = mergeNpcFile(text, { fields: { name: 'B' } });
    expect(out).toBe('# header\nname=B\n# talk\ntalker=true\n\n[stats]\n# s\nspeed=2\n\n[dialog]\nid=x\n# c\nhim=Hi\n');
  });
});
