// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { EditorProjectData, TileMapEditor } from '@/editor/TileMapEditor';
import { slugFileName } from '@/adapters/flare/flareAdapter.cjs';
import { resolveSaveMapName } from '@/editor/mapSaveName';
import useEditorTabs, { type EditorTab } from './useEditorTabs';

describe('resolveSaveMapName', () => {
  it('keeps the editor display name when it slugs to the same file as the tab', () => {
    expect(resolveSaveMapName('Untitled Map', 'Untitled_Map')).toBe('Untitled Map');
    expect(resolveSaveMapName('m1', 'm1')).toBe('m1');
  });

  it('uses the tab name when the editor name would write a different file', () => {
    expect(resolveSaveMapName('ab', 'm1')).toBe('m1');
  });

  it('falls back to whichever name is present', () => {
    expect(resolveSaveMapName('ab', '')).toBe('ab');
    expect(resolveSaveMapName('', 'm1')).toBe('m1');
    expect(resolveSaveMapName('', '')).toBeUndefined();
  });
});

type StoredMap = EditorProjectData & { objects: Array<Record<string, unknown>> };

function fileKey(name: string): string {
  return slugFileName(name) || name;
}

function createHarness(initialMapName = 'm1') {
  const files = new Map<string, StoredMap>();
  let mapName = initialMapName;
  let objects: Array<Record<string, unknown>> = [];
  let tabSwitching = false;
  let projectPath: string | null = '/proj';

  const editor = {
    getMapName: () => mapName,
    setMapName: (name: string) => { mapName = name; },
    getMapObjects: () => [...objects],
    getProjectData: vi.fn(async () => ({ name: mapName, width: 20, height: 15, objects: [...objects] })),
    ensureTilesetsLoaded: vi.fn(async () => {}),
    saveProjectData: vi.fn(async (_path: string, options?: { mapName?: string }) => {
      if (tabSwitching) return false;
      const name = (options?.mapName || mapName).trim();
      files.set(fileKey(name), {
        name,
        width: 20,
        height: 15,
        objects: objects.map((object) => ({ ...object })),
      } as StoredMap);
      return true;
    }),
    clearMapGrid: vi.fn(() => { objects = []; }),
    setTabSwitching: (value: boolean) => { tabSwitching = value; },
    getTabSwitching: () => tabSwitching,
    setCurrentProjectPath: vi.fn((path: string | null) => { projectPath = path; }),
    cancelPendingAutoSave: vi.fn(),
    addNpc(name: string) {
      objects.push({
        id: objects.length + 1,
        name,
        type: 'npc',
        category: 'npc',
        x: -1,
        y: -1,
        width: 1,
        height: 1,
        properties: {},
      });
    },
    load(data: StoredMap) {
      mapName = data.name || mapName;
      objects = (data.objects || []).map((object) => ({ ...object }));
    },
    get objects() { return objects; },
    get storedFiles() { return files; },
    get projectPath() { return projectPath; },
  };

  const helpersRef: MutableRefObject<{
    handleOpenMap: (projectDir: string, createTab?: boolean, mapName?: string) => Promise<void>;
    loadProjectData: (target: TileMapEditor, mapConfig: EditorProjectData) => Promise<boolean>;
    setupAutoSave: (target: TileMapEditor) => void;
    syncMapObjects: () => void;
    updateLayersList: () => void;
  }> = {
    current: {
      handleOpenMap: vi.fn(async () => {}),
      loadProjectData: vi.fn(async (_target, mapConfig) => {
        editor.load(mapConfig as StoredMap);
        return true;
      }),
      setupAutoSave: vi.fn(),
      syncMapObjects: vi.fn(),
      updateLayersList: vi.fn(),
    },
  };

  window.electronAPI = {
    openMapProject: vi.fn(async (_path: string, name?: string) => {
      if (!name) return null;
      return files.get(fileKey(name)) ?? null;
    }),
  } as unknown as typeof window.electronAPI;

  const hook = renderHook(() => useEditorTabs({
    editor: editor as unknown as TileMapEditor,
    currentProjectPath: '/proj',
    setCurrentProjectPath: vi.fn(),
    syncMapConfigForTab: vi.fn(),
    switchToTabHelpersRef: helpersRef,
  }));

  return { editor, helpersRef, hook };
}

async function createTabs(hook: ReturnType<typeof createHarness>['hook'], names: string[]) {
  const created: EditorTab[] = [];
  await act(async () => {
    for (const name of names) {
      created.push(hook.result.current.createTabFor(name, '/proj', { name, width: 20, height: 15 }));
    }
  });
  return created;
}

describe('switchToTab unplaced NPC persistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('saves an unplaced talker on the current map and restores it after switching away and back', async () => {
    const { editor, hook } = createHarness('m1');
    const [m1, m2] = await createTabs(hook, ['m1', 'm2']);

    await act(async () => {
      hook.result.current.setActiveTabId(m1.id);
    });
    editor.setMapName('m1');
    editor.addNpc('talkerTEst');

    await act(async () => {
      await hook.result.current.switchToTab(m2.id);
    });

    const savedM1 = editor.storedFiles.get('m1');
    expect(savedM1?.objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'talkerTEst', type: 'npc', x: -1, y: -1 }),
    ]));
    expect(editor.objects).toEqual([]);
    expect(hook.result.current.activeTabId).toBe(m2.id);

    await act(async () => {
      await hook.result.current.switchToTab(m1.id);
    });

    expect(hook.result.current.activeTabId).toBe(m1.id);
    expect(editor.objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'talkerTEst', type: 'npc', x: -1, y: -1 }),
    ]));
  });

  it('writes the leaving tab file even when editor.mapName is still a previous map', async () => {
    const { editor, hook } = createHarness('ab');
    const [m1, m2] = await createTabs(hook, ['m1', 'm2']);

    await act(async () => {
      hook.result.current.setActiveTabId(m1.id);
    });
    // Stale name that previously caused talkers to land in ab.json
    editor.setMapName('ab');
    editor.addNpc('talkerTEst');

    await act(async () => {
      await hook.result.current.switchToTab(m2.id);
    });

    expect(editor.storedFiles.get('ab')).toBeUndefined();
    expect(editor.storedFiles.get('m1')?.objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'talkerTEst' }),
    ]));

    await act(async () => {
      await hook.result.current.switchToTab(m1.id);
    });
    expect(editor.objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'talkerTEst' }),
    ]));
  });

  it('aborts the switch and keeps the NPC in memory when save fails', async () => {
    const { editor, hook } = createHarness('m1');
    const [m1, m2] = await createTabs(hook, ['m1', 'm2']);

    await act(async () => {
      hook.result.current.setActiveTabId(m1.id);
    });
    editor.setMapName('m1');
    editor.addNpc('talkerTEst');
    editor.saveProjectData.mockResolvedValueOnce(false);

    await act(async () => {
      await hook.result.current.switchToTab(m2.id);
    });

    expect(hook.result.current.activeTabId).toBe(m1.id);
    expect(editor.clearMapGrid).not.toHaveBeenCalled();
    expect(editor.objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'talkerTEst' }),
    ]));
  });
});
