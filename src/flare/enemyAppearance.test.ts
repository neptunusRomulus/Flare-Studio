import { describe, expect, it } from 'vitest';
import {
  enemyLookSelectionProps,
  enemyLooksFromListing,
  findEnemyLook,
  resolveEnemyLooks,
  resolveEnemyPortraits,
} from './enemyAppearance';
import type { TemplateActorListing } from './templateActors';

const listing = {
  ok: true,
  mod: 'fantasycore',
  modDir: '/flare/mods/fantasycore',
  npcLooks: [],
  enemyLooks: [
    {
      key: 'goblin',
      animation: 'animations/enemies/goblin.txt',
      image: 'images/enemies/goblin.png',
      imagePath: '/flare/mods/fantasycore/images/enemies/goblin.png',
      frame: { x: 142, y: 977, w: 111, h: 96 },
    },
  ],
  portraits: [{ key: 'male01', path: 'images/portraits/male01.png', imagePath: '/flare/mods/fantasycore/images/portraits/male01.png' }],
  npcs: [],
  enemies: [],
  missing: [],
} as TemplateActorListing;

describe('enemy looks', () => {
  it('labels fantasycore enemy animations and keeps the stance frame', () => {
    const looks = enemyLooksFromListing(listing);
    expect(looks).toEqual([
      expect.objectContaining({
        key: 'goblin',
        label: 'Goblin',
        animation: 'animations/enemies/goblin.txt',
        frame: { x: 142, y: 977, w: 111, h: 96 },
        source: 'fantasycore',
      }),
    ]);
  });

  it('selecting a look sets Flare animations and the Studio thumbnail path', () => {
    const [look] = enemyLooksFromListing(listing);
    expect(enemyLookSelectionProps(look)).toEqual({
      animations: 'animations/enemies/goblin.txt',
      tilesetPath: 'animations/enemies/goblin.txt',
      gfx: null,
    });
  });

  it('finds the selected look from animations or tilesetPath', () => {
    const looks = enemyLooksFromListing(listing);
    expect(findEnemyLook(looks, 'animations/enemies/goblin.txt', '')?.key).toBe('goblin');
    expect(findEnemyLook(looks, '', 'animations/enemies/goblin.txt')?.key).toBe('goblin');
    expect(findEnemyLook(looks, 'animations/enemies/zombie.txt', '')).toBeNull();
  });

  it('adds the project animations/enemies files after the fantasycore ones', async () => {
    const api = {
      listTemplateActors: async () => listing,
      readDir: async (dir: string) => (
        dir === '/proj/animations/enemies'
          ? [{ name: 'goblin.txt', isDirectory: false }, { name: 'my_boss.txt', isDirectory: false }]
          : []
      ),
      readFile: async (path: string) => (path === '/proj/animations/enemies/my_boss.txt' ? 'image=images/enemies/my_boss.png\n' : null),
      fileExists: async (path: string) => path === '/proj/images/enemies/my_boss.png',
    };
    const looks = await resolveEnemyLooks('/proj', api, '/flare');
    expect(looks.map((l) => `${l.source}:${l.key}`)).toEqual(['fantasycore:goblin', 'project:my_boss']);
    expect(looks[1]).toEqual(expect.objectContaining({
      animation: 'animations/enemies/my_boss.txt',
      imagePath: '/proj/images/enemies/my_boss.png',
      frame: null,
    }));
  });

  it('falls back to the mod image for project files that are not copied', async () => {
    const api = {
      listTemplateActors: async () => listing,
      readDir: async () => [{ name: 'shared.txt', isDirectory: false }],
      readFile: async () => 'image=images/enemies/goblin.png\n',
      fileExists: async () => false,
    };
    const looks = await resolveEnemyLooks('/proj', api, '/flare');
    expect(looks[1].imagePath).toBe('/flare/mods/fantasycore/images/enemies/goblin.png');
  });

  it('lists fantasycore portraits and adds project ones', async () => {
    const api = {
      listTemplateActors: async () => listing,
      readDir: async (dir: string) => (
        dir === '/proj/images/portraits' ? [{ name: 'kayl.png', isDirectory: false }] : []
      ),
    };
    const portraits = await resolveEnemyPortraits('/proj', api, '/flare');
    expect(portraits.map((p) => `${p.source}:${p.path}`)).toEqual([
      'fantasycore:images/portraits/male01.png',
      'project:images/portraits/kayl.png',
    ]);
  });
});
