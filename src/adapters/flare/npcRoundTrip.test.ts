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
  it.each(files)('%s survives import + export unchanged', (file) => {
    const text = fs.readFileSync(path.join(FIXTURES, file), 'utf8');
    expect(canon(exportNpcFile(importNpcText(text)))).toEqual(canon(text));
    // strict: same lines in the same order (comments/blank lines aside)
    expect(lines(exportNpcFile(importNpcText(text)))).toEqual(lines(text));
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
});

const { normalizeEnemyText } = require('./serializers.cjs');

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
