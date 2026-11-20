import { describe, expect, it } from 'vitest';
import { candidateEnginePaths, loadEngineFileWithFallback, parseProjectRequires } from './engineFileFallback';

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
});
