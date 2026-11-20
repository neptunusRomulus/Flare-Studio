import { describe, expect, it } from 'vitest';
import { candidateEnginePaths, loadEngineFileWithFallback, parseProjectRequires, resolveExistingPath } from './engineFileFallback';

describe('engine file fallback', () => {
  it('parses project requires and prefers a later complete file over default', async () => {
    expect(parseProjectRequires(JSON.stringify({ requires: ['fantasycore', 'empyrean_campaign:1.0'] }))).toEqual([
      'fantasycore',
      'empyrean_campaign',
    ]);
    const paths = candidateEnginePaths({
      projectRoot: '/proj',
      flarePath: '/opt/flare-engine',
      requires: ['fantasycore'],
      relative: 'engine/primary_stats.txt',
    });
    expect(paths[0]).toBe('/proj/engine/primary_stats.txt');
    expect(paths).toContain('/opt/flare-engine/mods/default/engine/primary_stats.txt');
    expect(paths).toContain('/opt/flare-game/mods/fantasycore/engine/primary_stats.txt');

    const files: Record<string, string> = {
      '/opt/flare-engine/mods/default/engine/primary_stats.txt': '[stat]\nid=physical\nname=Physical\n',
      '/opt/flare-game/mods/fantasycore/engine/primary_stats.txt': 'APPEND\n[stat]\nid=spirit\nname=Spirit\n',
    };
    const loaded = await loadEngineFileWithFallback({
      projectPath: '/proj',
      relative: 'engine/primary_stats.txt',
      flarePath: '/opt/flare-engine',
      requires: ['fantasycore'],
      fs: { readFile: async (abs) => files[abs] || '' },
    });
    expect(loaded.source).toBe('mod');
    expect(loaded.text).toContain('id=physical');
    expect(loaded.text).toContain('id=spirit');
  });

  it('uses a complete project file and ignores lower mods', async () => {
    const files: Record<string, string> = {
      '/proj/engine/titles.txt': '[title]\ntitle=Hero\n',
      '/opt/flare-engine/mods/default/engine/titles.txt': '[title]\ntitle=Default\n',
    };
    const loaded = await loadEngineFileWithFallback({
      projectPath: '/proj',
      relative: 'engine/titles.txt',
      flarePath: '/opt/flare-engine',
      requires: [],
      fs: { readFile: async (abs) => files[abs] || '' },
    });
    expect(loaded).toMatchObject({ source: 'project', label: 'project' });
    expect(loaded.text).toContain('title=Hero');
    expect(loaded.text).not.toContain('title=Default');
  });

  it('resolves an existing asset from the project before mods', async () => {
    const exists = new Set(['/proj/images/menus/powers.png']);
    const found = await resolveExistingPath({
      projectPath: '/proj',
      relative: 'images/menus/powers.png',
      flarePath: '/opt/flare-engine',
      requires: ['fantasycore'],
      fileExists: async (abs) => exists.has(abs),
    });
    expect(found).toBe('/proj/images/menus/powers.png');
    const fallback = await resolveExistingPath({
      projectPath: '/proj',
      relative: 'images/menus/powers.png',
      flarePath: '/opt/flare-engine',
      requires: ['fantasycore'],
      fileExists: async (abs) => abs === '/opt/flare-game/mods/fantasycore/images/menus/powers.png',
    });
    expect(fallback).toBe('/opt/flare-game/mods/fantasycore/images/menus/powers.png');
  });
});
