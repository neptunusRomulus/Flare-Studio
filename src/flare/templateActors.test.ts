import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { dedupeActors, enemyFileFromBase, planTemplateActors, titleFromKey, type TemplateActorListing } from './templateActors';
import { loadingLabel, progressLoading, beginLoading } from '@/components/loadingOverlayStore';

const require = createRequire(import.meta.url);
const { collectFlareRefs, listTemplateActors } = require('../../electron/flareActorTemplate.cjs');

const listing: TemplateActorListing = {
  ok: true,
  mod: 'fantasycore',
  npcLooks: [{ key: 'peasant_man1', animation: 'animations/npcs/peasant_man1.txt', image: 'images/npcs/peasant_man1.png', imagePath: null }],
  npcs: [],
  enemies: [
    { key: 'beacon', file: 'enemies/base/beacon.txt', raw: 'speed=0\n', isBase: true },
    { key: 'goblin_elite', file: 'enemies/base/goblin_elite.txt', raw: 'INCLUDE enemies/base/goblin.txt\nanimations=animations/enemies/goblin_elite.txt\n', isBase: true },
    { key: 'goblin', file: 'enemies/base/goblin.txt', raw: 'INCLUDE enemies/base/beacon.txt\nanimations=animations/enemies/goblin.txt\n', isBase: true },
    { key: 'il_antlion', file: 'enemies/il_antlion.txt', raw: 'name=Labyrinth Antlion\ncategories=il_antlion,il_common\nstat=hp,60\nstat=accuracy,80\n', isBase: false },
  ],
  missing: [],
};

describe('template actor references', () => {
  it('collects INCLUDE and file values, incl. comma lists', () => {
    const refs = collectFlareRefs('INCLUDE enemies/base/beacon.txt\n# x=a.png\nsfx_attack=swing,soundfx/enemies/goblin_phys.ogg\nanimations=animations/enemies/goblin.txt\nmelee_range=1.1875\n[stance]\nimage=images/npcs/a.png\n');
    expect(refs.sort()).toEqual(['animations/enemies/goblin.txt', 'enemies/base/beacon.txt', 'images/npcs/a.png', 'soundfx/enemies/goblin_phys.ogg']);
  });
  it('lists a mod fixture and reports missing references', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'actors-'));
    const mod = path.join(root, 'mods', 'fantasycore');
    for (const d of ['images/tilesets', 'animations/npcs', 'images/npcs', 'enemies/base']) fs.mkdirSync(path.join(mod, d), { recursive: true });
    fs.writeFileSync(path.join(mod, 'settings.txt'), '');
    fs.writeFileSync(path.join(mod, 'animations/npcs/knight.txt'), 'image=images/npcs/knight.png\n');
    fs.writeFileSync(path.join(mod, 'images/npcs/knight.png'), '');
    fs.writeFileSync(path.join(mod, 'enemies/base/zombie.txt'), 'animations=animations/enemies/zombie.txt\n');
    const probe = { platform: 'linux', exists: (p: string) => fs.existsSync(p), isDirectory: (p: string) => fs.existsSync(p) && fs.statSync(p).isDirectory() };
    const flareTemplate = require('../../electron/flareTemplate.cjs');
    const orig = flareTemplate.templateTilesetDir;
    flareTemplate.templateTilesetDir = () => ({ dataPath: root, dir: path.join(mod, 'images/tilesets') });
    try {
      const out = listTemplateActors('/x', { probe });
      expect(out.ok).toBe(true);
      expect(out.npcLooks).toEqual([expect.objectContaining({ key: 'knight', animation: 'animations/npcs/knight.txt', image: 'images/npcs/knight.png' })]);
      expect(out.enemies).toEqual([expect.objectContaining({ key: 'zombie', file: 'enemies/base/zombie.txt', isBase: true })]);
      expect(out.missing).toEqual(['enemies/base/zombie.txt -> animations/enemies/zombie.txt']);
    } finally {
      flareTemplate.templateTilesetDir = orig;
    }
  });
});

describe('template actor plan', () => {
  it('maps NPC looks and enemy bases to unplaced Entities', () => {
    const plan = planTemplateActors(listing);
    expect(plan.map(p => [p.type, p.name, p.category])).toEqual([
      ['npc', 'Peasant Man 1', undefined],
      ['enemy', 'Goblin Elite', 'goblin_elite'],
      ['enemy', 'Goblin', 'goblin'],
      ['enemy', 'Labyrinth Antlion', 'il_antlion'],
    ]);
    expect(plan[0].properties.tilesetPath).toBe('animations/npcs/peasant_man1.txt');
    expect(plan[2].file).toEqual({ rel: 'enemies/goblin.txt', content: enemyFileFromBase('enemies/base/goblin.txt', 'goblin') });
    expect(plan[2].file?.content).toContain('INCLUDE enemies/base/goblin.txt\nname=Goblin\ncategories=goblin');
    // full definitions are kept raw (repeated stat= lines survive)
    expect(plan[3].file?.content).toBe(listing.enemies[3].raw);
  });
  it('dedupes by import key / NPC look and keeps existing files', () => {
    const plan = planTemplateActors(listing);
    const existing: Parameters<typeof dedupeActors>[1] = [
      { type: 'npc' as const, name: 'x', properties: { tilesetPath: 'animations/npcs/peasant_man1.txt' } },
      { type: 'enemy' as const, name: 'y', properties: { importKey: 'fantasycore:enemy:il_antlion' } },
    ];
    const { keep, skipped } = dedupeActors(plan, existing, new Set(['enemies/goblin.txt']));
    expect(skipped).toBe(2);
    expect(keep.map(k => k.name)).toEqual(['Goblin Elite', 'Goblin']);
    expect(keep[1].file).toBeUndefined();
    expect(keep[0].file?.rel).toBe('enemies/goblin_elite.txt');
    expect(dedupeActors([...plan, ...plan], [], new Set()).keep).toHaveLength(4);
  });
  it('titles keys', () => {
    expect(titleFromKey('goblin_elite_runner')).toBe('Goblin Elite Runner');
    expect(titleFromKey('female01')).toBe('Female 01');
  });
  it('overlay shows the step label', () => {
    const s = progressLoading(beginLoading({ tokens: [] }, 'template', 0), 'template', 1, 3, 'Loading NPCs and enemies…');
    expect(loadingLabel(s)).toBe('Loading NPCs and enemies…');
  });
});
