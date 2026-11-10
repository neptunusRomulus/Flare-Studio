import { describe, expect, it } from 'vitest';
import { npcListThumbPath, resolveNpcPreviewPaths } from './npcPreviewPaths';

describe('resolveNpcPreviewPaths', () => {
  it('keeps data-URL and absolute portraits (hand-made import)', async () => {
    const data = await resolveNpcPreviewPaths({ portraitPath: 'data:image/png;base64,abc' }, {}, null);
    expect(data.portrait).toBe('data:image/png;base64,abc');
    const abs = await resolveNpcPreviewPaths({ portraitPath: '/tmp/portraits/a.png' }, {}, null);
    expect(abs.portrait).toBe('/tmp/portraits/a.png');
  });

  it('resolves a project-relative portrait used by imported NPC files', async () => {
    const api = { fileExists: async (p: string) => p === '/proj/images/portraits/kayl.png' };
    const out = await resolveNpcPreviewPaths(
      { portraitPath: 'images/portraits/kayl.png', projectPath: '/proj' },
      api,
      null,
    );
    expect(out.portrait).toBe('/proj/images/portraits/kayl.png');
  });

  it('falls back to a fantasycore look image when there is no portrait', async () => {
    const api = {
      listTemplateActors: async () => ({
        npcLooks: [{ animation: 'animations/npcs/peasant_man1.txt', image: 'images/npcs/peasant_man1.png', imagePath: '/flare/mods/fantasycore/images/npcs/peasant_man1.png' }],
        portraits: [],
        modDir: '/flare/mods/fantasycore',
      }),
    };
    const out = await resolveNpcPreviewPaths(
      { tilesetPath: 'animations/npcs/peasant_man1.txt', templateImage: 'images/npcs/peasant_man1.png' },
      api,
      '/flare',
    );
    expect(out.portrait).toBeNull();
    expect(out.sprite).toBe('/flare/mods/fantasycore/images/npcs/peasant_man1.png');
    expect(npcListThumbPath(out)).toBe('/flare/mods/fantasycore/images/npcs/peasant_man1.png');
  });

  it('prefers the portrait over the look sprite for the list thumb', () => {
    expect(npcListThumbPath({ portrait: '/p.png', sprite: '/s.png' })).toBe('/p.png');
    expect(npcListThumbPath({ portrait: null, sprite: '/s.png' })).toBe('/s.png');
  });
});
