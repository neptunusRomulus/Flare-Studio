import { describe, expect, it, vi } from 'vitest';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { MapObject } from '@/types';
import {
  buildAnimationFileContent,
  collectNpcExportFiles,
  exportFlareTextFiles,
  sanitizeNpcFileName,
  type ManualSaveFileApi,
} from './manualSaveExport';

function npc(overrides: Partial<MapObject> & { properties: Record<string, string> }): MapObject {
  return {
    id: 7,
    type: 'npc',
    name: 'Alice',
    x: 3,
    y: 4,
    ...overrides,
  } as MapObject;
}

function fakeEditor(objects: MapObject[]): TileMapEditor {
  return { getMapObjects: () => objects } as unknown as TileMapEditor;
}

describe('buildAnimationFileContent', () => {
  it('uses stored anim_* properties when present', () => {
    const text = buildAnimationFileContent('images/npcs/alice.png', null, {
      anim_render_width: '32',
      anim_render_height: '48',
      anim_frames: '3',
      anim_duration: '900ms',
      anim_type: 'once',
    });
    expect(text).toContain('image=images/npcs/alice.png');
    expect(text).toContain('render_size=32,48');
    expect(text).toContain('render_offset=16,46');
    expect(text).toContain('[stance]');
    expect(text).toContain('frames=3');
    expect(text).toContain('duration=900ms');
    expect(text).toContain('type=once');
    // Multi-frame: no explicit frame= line, no blend/alpha/color defaults
    expect(text).not.toContain('frame=');
    expect(text).not.toContain('blend_mode=');
  });

  it('derives a horizontal sprite strip from image dimensions', () => {
    const text = buildAnimationFileContent('images/npcs/alice.png', { width: 96, height: 48 });
    expect(text).toContain('render_size=48,48');
    expect(text).toContain('frames=2');
    expect(text).toContain('duration=1200ms');
  });

  it('falls back to a minimal stance without properties or dimensions', () => {
    const text = buildAnimationFileContent('images/npcs/alice.png', null);
    expect(text).toContain('[stance]');
    expect(text).toContain('frames=1');
    expect(text).toContain('duration=1s');
  });
});

describe('sanitizeNpcFileName', () => {
  it('lowercases, replaces path/space characters and collapses repeats', () => {
    expect(sanitizeNpcFileName('The  /Bad|Name')).toBe('the_bad_name');
  });

  it('falls back to unnamed_npc when nothing is left', () => {
    expect(sanitizeNpcFileName('  ')).toBe('unnamed_npc');
  });
});

describe('collectNpcExportFiles', () => {
  it('collects NPC definition, portrait and animation files', async () => {
    const object = npc({
      properties: {
        npcFilename: 'npcs/Alice.txt',
        talker: 'true',
        portraitSourcePath: '/game/gfx/alice_portrait.png',
        tilesetSourcePath: '/game/gfx/alice.png',
      },
    });
    const api: ManualSaveFileApi = {
      fileExists: async (p) => p.startsWith('/proj'),
      readFile: async (p) => {
        if (p.endsWith('/animations/npcs/alice.txt')) return 'image=images/npcs/alice.png\n';
        if (p.endsWith('/npcs/Alice.txt')) return 'name=Alice\n\n[stats]\nhp=5\n';
        return null;
      },
    };

    const files = await collectNpcExportFiles(fakeEditor([object]), '/proj', api);

    expect(files.npcFiles).toHaveLength(1);
    expect(files.npcFiles[0].filename).toBe('Alice.txt');
    expect(files.npcFiles[0].content).toContain('animations/npcs/alice.txt');
    expect(files.npcFiles[0].content).toContain('images/portraits/alice_portrait.png');
    // Unknown sections from the existing file survive the merge
    expect(files.npcFiles[0].content).toContain('[stats]');
    expect(files.npcFiles[0].content).toContain('hp=5');

    expect(files.portraitFiles).toEqual([
      { sourcePath: '/proj/images/portraits/alice_portrait.png', destFilename: 'alice_portrait.png' },
    ]);
    expect(files.npcTilesetImages).toEqual([
      { sourcePath: '/proj/images/npcs/alice.png', destFilename: 'alice.png' },
    ]);
    expect(files.npcAnimationFiles).toHaveLength(1);
    expect(files.npcAnimationFiles[0].filename).toBe('alice.txt');
    expect(files.npcAnimationFiles[0].content).toContain('image=images/npcs/alice.png');
  });

  it('never overwrites a hand-made animation file', async () => {
    const object = npc({
      properties: {
        npcFilename: 'npcs/Alice.txt',
        tilesetSourcePath: '/proj/images/npcs/alice.png',
      },
    });
    const api: ManualSaveFileApi = {
      fileExists: async () => true,
      readFile: async (p) => (p.endsWith('/animations/npcs/alice.txt') ? 'image=other.png\n' : null),
    };

    const files = await collectNpcExportFiles(fakeEditor([object]), '/proj', api);

    expect(files.npcFiles[0].content).toContain('animations/npcs/alice_studio.txt');
    expect(files.npcAnimationFiles[0].filename).toBe('alice_studio.txt');
  });
});

describe('exportFlareTextFiles', () => {
  function textEditor(): TileMapEditor {
    return {
      getMapName: () => 'Map1',
      generateFlareMapTxt: () => 'map text',
      generateFlareTilesetDef: () => 'tileset text',
      getTilesetExportInfo: () => [],
      getMapObjects: () => [],
    } as unknown as TileMapEditor;
  }

  it('writes the export through the IPC bridge', async () => {
    const saveExportFiles = vi.fn(async (
      _projectPath: string,
      _mapName: string,
      _mapTxt: string,
      _tilesetDef: string,
      _files: unknown
    ) => ({ success: true }));
    await exportFlareTextFiles(textEditor(), '/proj', { saveExportFiles });

    expect(saveExportFiles).toHaveBeenCalledTimes(1);
    const args = saveExportFiles.mock.calls[0];
    expect(args[0]).toBe('/proj');
    expect(args[1]).toBe('Map1');
    expect(args[2]).toBe('map text');
    expect(args[3]).toBe('tileset text');
  });

  it('throws when the IPC bridge reports a validation failure', async () => {
    const saveExportFiles = vi.fn(async (
      _projectPath: string,
      _mapName: string,
      _mapTxt: string,
      _tilesetDef: string,
      _files: unknown
    ) => ({ success: false, message: 'bad map' }));
    await expect(exportFlareTextFiles(textEditor(), '/proj', { saveExportFiles })).rejects.toThrow('bad map');
  });

  it('skips quietly when there is no project path', async () => {
    const saveExportFiles = vi.fn(async () => ({ success: true }));
    await exportFlareTextFiles(textEditor(), null, { saveExportFiles });
    expect(saveExportFiles).not.toHaveBeenCalled();
  });
});
