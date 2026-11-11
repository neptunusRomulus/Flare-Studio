import { describe, expect, it } from 'vitest';
import { buildPowerProject, type ProjectFile } from './powerProject';
import { categorizePower, classifyEffect } from './powerKinds';
import { summarizeEffect, summarizePower } from './powerSummary';
import { rawFromSlider, sliderValue, tierOf } from './powerTiers';
import { POWER_TEMPLATES, EFFECT_TEMPLATES } from './powerTemplates';
import { addChainLink, effectWarnings, powerWarnings, readChain, removeChainLink, updateChainLink } from './powerChecks';
import { appendBlock, parseSectionFile, blockRecord } from './sectionFile';
import { keysFor } from '../../adapters/flare/attributeKeys.cjs';

const POWER_KEYS = [...(keysFor('powers', 'power') || [])];

// Trimmed from flare-game empyrean_campaign (af6eee6).
const files: ProjectFile[] = [
  { path: 'powers/base/magician/fireball.txt', text: 'type=missile\nspeed=16\nlifespan=800ms\nradius=1.0\nbase_damage=ment\ntrait_elemental=fire\n' },
  { path: 'powers/powers.txt', text: [
    '# Fireball', '[power]', 'id=122', 'INCLUDE powers/base/magician/fireball.txt', 'name=Fireball', 'requires_mp=5', 'modifier_damage=multiply,130,0', '',
    '[power]', 'id=136', 'name=Shield', 'type=fixed', 'buff=true', 'post_effect=mage_shield,0,0', 'cooldown=30s', '',
    '# forgotten spell', '[power]', 'id=500', 'type=fixed', 'requires_mp=10', 'post_effect=nope,1,1s', '',
  ].join('\n') },
  { path: 'powers/categories/enemy.txt', text: '[power]\nid=240\nname=Teleport\ntype=fixed\nbuff_teleport=true\ntarget_range=8\ncooldown=6s\npost_power=241\n\n[power]\nid=241\nname=Slowing bite\ntype=fixed\nuse_hazard=true\nbase_damage=melee\npost_effect=slow,50,5s\n' },
  { path: 'powers/categories/items.txt', text: '[power]\nid=1\nname=Health Potion\ntype=fixed\nbuff=true\npost_effect=hp_heal,25,1s\n' },
  { path: 'powers/categories/environment.txt', text: '[power]\nid=178\nname=Spikes\ntype=fixed\nuse_hazard=true\nbase_damage=melee\npost_effect=bleeding,5,10s\n' },
  { path: 'powers/effects.txt', text: [
    '[effect]', 'id=mage_shield', 'name=Shield', 'type=shield', 'can_stack=false', '',
    '[effect]', 'id=slow', 'name=Slow', 'type=speed', '',
    '[effect]', 'id=hp_heal', 'type=heal', '',
    '[effect]', 'id=bleeding', 'name=Bleeding', 'type=damage_percent', '',
    '[effect]', 'id=lonely', 'name=Lonely', 'type=stun', '',
  ].join('\n') },
  { path: 'powers/trees/default.txt', text: '[power]\nid=122\npos=0,0\n\n[power]\nid=136\npos=1,0\n' },
  { path: 'engine/classes.txt', text: '[class]\nname=Mage\nactionbar=0,122\n' },
  { path: 'enemies/goblin.txt', text: 'name=Goblin\npower=melee,241,5\npassive_powers=240\ndefeat_status=goblin_dead\n' },
  { path: 'items/items.txt', text: '[item]\nid=1\nname=Health Potion\npower=1\n' },
  { path: 'maps/cave.txt', text: '[header]\ntitle=Cave\n\n[event]\ntype=event\npower=178\nrequires_not_status=spikes_off\n' },
  { path: 'npcs/guard.txt', text: 'name=Guard\n[dialog]\ntopic=Hello\nrequires_status=goblin_dead\nset_status=guard_thanked\n' },
];
const project = buildPowerProject(files);
const power = (id: string) => project.powers.find((p) => p.id === id)!;
const effect = (id: string) => project.effects.find((e) => e.id === id)!;
const kindOf = (id: string) => categorizePower(power(id), project.powerUsedBy[id] || []);

describe('power project index', () => {
  it('merges INCLUDE keys under own keys', () => {
    expect(power('122').keys.type).toEqual(['missile']);
    expect(power('122').keys.speed).toEqual(['16']);
    expect(power('122').name).toBe('Fireball');
    expect(power('500').name).toBe('Forgotten spell');
  });

  it('collects used-by from enemies, items, events, trees, classes and other powers', () => {
    const kinds = (id: string) => (project.powerUsedBy[id] || []).map((u) => `${u.kind}:${u.name}`).sort();
    expect(kinds('122')).toEqual(['class:Mage', 'skill_tree:default']);
    expect(kinds('241')).toEqual(['enemy:Goblin', 'power:Teleport']);
    expect(kinds('240')).toEqual(['enemy:Goblin']);
    expect(kinds('1')).toEqual(['item:Health Potion']);
    expect(kinds('178')).toEqual(['event:Cave']);
    expect(project.powerUsedBy['500']).toBeUndefined();
    expect(project.effectUsedBy.slow[0]).toMatchObject({ name: 'Slowing bite', magnitude: '50', duration: '5s' });
  });

  it('collects story flags with who sets and reads them', () => {
    expect(project.flags.goblin_dead).toEqual({ setBy: ['Goblin'], readBy: ['Guard · Hello'] });
    expect(Object.keys(project.flags).sort()).toEqual(['goblin_dead', 'guard_thanked', 'spikes_off']);
  });
});

describe('categorization', () => {
  it('names powers by usage', () => {
    expect(kindOf('122')).toBe('skill');
    expect(kindOf('240')).toBe('monster');
    expect(kindOf('241')).toBe('monster');
    expect(kindOf('1')).toBe('item');
    expect(kindOf('178')).toBe('trap');
  });

  it('powers triggered only by other powers take their kind', async () => {
    const { resolvePowerKinds } = await import('./powerKinds');
    const extra = buildPowerProject([...files, { path: 'powers/extra.txt', text: '[power]\nid=600\nname=Splash\ntype=fixed\n\n[power]\nid=601\nname=Thrown\npost_power=600\n' },
      { path: 'items/more.txt', text: '[item]\nid=9\nname=Bomb\npower=601\n' }]);
    const kinds = resolvePowerKinds(extra);
    expect(kinds['600']).toBe('item');
    expect(kinds['601']).toBe('item');
    expect(kinds['241']).toBe('monster');
    expect(kinds['500']).toBe('skill');
  });

  it('falls back to the picked type, then the file name', () => {
    expect(categorizePower(power('500'), [], 'trap')).toBe('trap');
    expect(categorizePower(power('500'), [])).toBe('skill');
    expect(categorizePower({ path: 'powers/categories/enemy.txt' }, [])).toBe('monster');
    expect(categorizePower({ path: 'powers/powers.txt', name: 'Health Potion' }, [])).toBe('item');
    const bar = [{ kind: 'class' as const, name: 'Brute', path: 'engine/classes.txt', key: 'actionbar' }];
    expect(categorizePower({ path: 'powers/categories/items.txt', name: 'Health Potion' }, bar)).toBe('item');
    expect(categorizePower({ path: 'powers/powers.txt', name: 'Swing' }, bar)).toBe('skill');
  });

  it('classifies effects as Buff or Debuff', () => {
    const cls = (id: string) => classifyEffect(effect(id), project.effectUsedBy[id] || []);
    expect(cls('mage_shield')).toBe('buff');
    expect(cls('hp_heal')).toBe('buff');
    expect(cls('slow')).toBe('debuff');
    expect(cls('bleeding')).toBe('debuff');
    expect(cls('lonely')).toBe('debuff');
  });
});

describe('summary', () => {
  it('describes a power in one sentence', () => {
    const s = summarizePower(power('122').keys);
    expect(s).toMatch(/^Costs 5 mana, /);
    expect(s).toContain('fire');
    expect(s.endsWith('.')).toBe(true);
    expect(summarizePower(power('241').keys, { slow: 'Slow' })).toContain('applies Slow 50 for 5s');
    expect(summarizePower(power('136').keys)).toContain('usable every 30s');
  });

  it('describes an effect', () => {
    expect(summarizeEffect(effect('mage_shield').keys, 'Buff')).toBe('Buff: shield, does not stack.');
  });
});

describe('tiers', () => {
  it('labels values with flare-game bands', () => {
    expect(tierOf('modifier_damage', 130)).toBe('Balanced');
    expect(tierOf('modifier_damage', 300)).toBe('Strong');
    expect(tierOf('modifier_damage', 50)).toBe('Weak');
    expect(tierOf('cooldown', 30)).toBe('Weak');
    expect(tierOf('cooldown', 0.5)).toBe('Strong');
    expect(tierOf('unknown_key', 3)).toBeNull();
  });

  it('converts slider numbers to raw Flare values and back', () => {
    expect(sliderValue('cooldown', '1500ms')).toBe(1.5);
    expect(rawFromSlider('cooldown', 0.5)).toBe('500ms');
    expect(rawFromSlider('cooldown', 6)).toBe('6s');
    expect(sliderValue('modifier_damage', 'multiply,130,0')).toBe(130);
    expect(rawFromSlider('modifier_damage', 150, 'multiply,130,5')).toBe('multiply,150,5');
  });
});

describe('warnings', () => {
  it('flags unused mana powers and missing effects', () => {
    const w = powerWarnings(power('500'), 'skill', [], project).map((x) => x.text);
    expect(w).toContain('Has a mana cost but no player can use it');
    expect(w).toContain('This Skill is never used');
    expect(w).toContain('Applies "nope", which does not exist');
    expect(powerWarnings(power('122'), 'skill', project.powerUsedBy['122'], project)).toEqual([]);
  });

  it('flags unused effects', () => {
    expect(effectWarnings(effect('lonely'), 'debuff', []).map((x) => x.text)).toEqual(['This Debuff is never used']);
    expect(effectWarnings(effect('slow'), 'debuff', project.effectUsedBy.slow)).toEqual([]);
  });
});

describe('effect chain round-trip', () => {
  const text = files[1].text;
  it('adds, edits and removes post_effect lines without touching the rest', () => {
    const added = addChainLink(text, 1, { effectId: 'slow', magnitude: '50', duration: '5s', chance: '' });
    expect(added).toBe(text.replace('post_effect=mage_shield,0,0\n', 'post_effect=mage_shield,0,0\npost_effect=slow,50,5s\n'));
    const chain = readChain(blockRecord(parseSectionFile(added, 'power').blocks[1]));
    expect(chain.map((c) => c.effectId)).toEqual(['mage_shield', 'slow']);
    const edited = updateChainLink(added, 1, 'post_effect', 1, { effectId: 'slow', magnitude: '30', duration: '2s', chance: '50' });
    expect(edited).toContain('post_effect=slow,30,2s,50\n');
    expect(removeChainLink(edited, 1, 'post_effect', 1)).toBe(text);
    const src = addChainLink(text, 0, { effectId: 'haste', magnitude: '120', duration: '10s', chance: '' }, true);
    expect(src).toContain('modifier_damage=multiply,130,0\npost_effect_src=haste,120,10s\n');
  });
});

describe('templates', () => {
  it('only use real engine power keys and round-trip as new blocks', () => {
    const known = new Set<string>(POWER_KEYS);
    for (const template of POWER_TEMPLATES) {
      for (const [key] of template.keys) expect(known.has(key), `${template.id}.${key}`).toBe(true);
      if (template.effect) expect(EFFECT_TEMPLATES.some((e) => e.id === template.effect!.template)).toBe(true);
      const text = appendBlock(files[1].text, 'power', [['id', '900'], ...template.keys]);
      expect(text.startsWith(files[1].text)).toBe(true);
      const block = parseSectionFile(text, 'power').blocks.at(-1)!;
      expect(block.id).toBe('900');
      expect(block.entries.length).toBe(template.keys.length + 1);
    }
    for (const kind of ['skill', 'monster', 'item', 'trap']) expect(POWER_TEMPLATES.some((t) => t.kind === kind)).toBe(true);
  });
});

describe('project files', () => {
  it('picks a file for new powers and keeps the kind sidecar tidy', async () => {
    const { fileForNewPower, parseKindSidecar, serializeKindSidecar, loadPowerFiles, joinPath } = await import('./powerFiles');
    const paths = ['powers/powers.txt', 'powers/categories/enemy.txt', 'powers/categories/items.txt'];
    expect(fileForNewPower('monster', paths)).toBe('powers/categories/enemy.txt');
    expect(fileForNewPower('item', paths)).toBe('powers/categories/items.txt');
    expect(fileForNewPower('trap', paths)).toBe('powers/powers.txt');
    expect(fileForNewPower('skill', [])).toBe('powers/powers.txt');
    expect(parseKindSidecar(serializeKindSidecar({ '10': 'trap', '2': 'item' }))).toEqual({ '2': 'item', '10': 'trap' });
    expect(parseKindSidecar('not json')).toEqual({});
    expect(joinPath('C:\\mods\\x', 'powers/a.txt')).toBe('C:\\mods\\x\\powers\\a.txt');
    const disk: Record<string, string> = { '/m/powers/a.txt': '[power]\nid=1\n', '/m/engine/classes.txt': '[class]\n' };
    const api = {
      readDir: async (dir: string) => (dir === '/m/powers' ? [{ name: 'a.txt', isDirectory: false }, { name: 'x.png', isDirectory: false }] : []),
      readFile: async (p: string) => disk[p] ?? null,
    };
    expect(await loadPowerFiles(api, '/m')).toEqual([{ path: 'powers/a.txt', text: '[power]\nid=1\n' }, { path: 'engine/classes.txt', text: '[class]\n' }]);
  });
});

describe('create from template', () => {
  it('appends a power (and its effect when missing) without touching existing lines', async () => {
    const { createFromTemplate } = await import('./powerCreate');
    const textOf = (p: string) => files.find((f) => f.path === p)?.text ?? '';
    const r = createFromTemplate(project, textOf, 'trap', 'poison_cloud');
    expect(r.target).toEqual({ type: 'power', id: '501' });
    expect(r.writes.map((w) => w.path)).toEqual(['powers/effects.txt', 'powers/categories/environment.txt']);
    expect(r.writes[0].text.startsWith(textOf('powers/effects.txt'))).toBe(true);
    expect(r.writes[0].text).toContain('[effect]\nid=poison\nname=Poison\n');
    expect(r.writes[1].text.startsWith(textOf('powers/categories/environment.txt'))).toBe(true);
    expect(r.writes[1].text).toContain('id=501\nname=Poison Cloud\n');
    expect(r.writes[1].text).toContain('post_effect=poison,5,3s\n');
    const reuse = createFromTemplate(project, textOf, 'monster', 'monster_spit');
    expect(reuse.writes.map((w) => w.path)).toEqual(['powers/categories/enemy.txt']);
    expect(reuse.writes[0].text).toContain('post_effect=slow,50,3s\n');
    const buff = createFromTemplate(project, textOf, 'buff', 'shield');
    expect(buff.target).toEqual({ type: 'effect', id: 'mage_shield_2' });
  });
});

describe('story flag suggestions', () => {
  it('lists project flags with where they are set', async () => {
    const { flagSuggestions, isStoryFlagType } = await import('./storyFlags');
    expect(flagSuggestions(project.flags)).toEqual([
      { value: 'goblin_dead', label: 'set by Goblin' },
      { value: 'guard_thanked', label: 'set by Guard · Hello' },
      { value: 'spikes_off', label: 'checked by Cave (never set)' },
    ]);
    for (const t of ['status', 'not_status', 'requires_status', 'requires_not_status', 'set_status', 'unset_status', 'defeat_status']) expect(isStoryFlagType(t), t).toBe(true);
    for (const t of ['requires_level', 'requires_item', 'random_status', '', null]) expect(isStoryFlagType(t), String(t)).toBe(false);
  });
});
