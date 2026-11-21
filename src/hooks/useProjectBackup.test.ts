import { describe, expect, it, vi } from 'vitest';
import { buildProjectBackup, normalizeProjectBackup } from '@/editor/projectSession';

describe('multi-map backup restore contract', () => {
  it('keeps two maps and editor drafts through normalize', () => {
    const packed = buildProjectBackup({
      timestamp: Date.now(),
      currentMapName: 'hall',
      currentSnapshot: { mapName: 'hall', heroX: 3, mapWidth: 10 },
      mapDrafts: [{ mapName: 'cellar', snapshot: { mapName: 'cellar', objects: [{ type: 'event' }], mapWidth: 6 } }],
      editors: { books: [{ path: 'books/a.txt', content: 'A' }] },
    });
    const restored = normalizeProjectBackup(packed);
    expect(restored?.maps.map((m) => m.mapName).sort()).toEqual(['cellar', 'hall']);
    expect(restored?.editors.books?.[0].content).toBe('A');
  });
});

describe('saveAll inactive map drafts', () => {
  it('exports every non-current map draft, then reloads the current snapshot', async () => {
    const exported: string[] = [];
    const editor = {
      getMapName: () => 'hall',
      buildCrashBackupSnapshot: () => ({ mapName: 'hall', heroX: 3 }),
      setTabSwitching: vi.fn(),
      loadFromBackupData: vi.fn((data: { mapName?: string; timestamp?: number }) => {
        exported.push(`load:${data.mapName}`);
        return true;
      }),
      saveProjectData: vi.fn(async (_path: string, opts?: { mapName?: string }) => {
        exported.push(`json:${opts?.mapName}`);
        return true;
      }),
      markAsFullySaved: vi.fn(),
      redraw: vi.fn(),
    };

    // Exercise the same sequence useProjectBackup.saveInactiveMapDrafts uses.
    const drafts = [
      { mapName: 'hall', snapshot: { mapName: 'hall' } },
      { mapName: 'cellar', snapshot: { mapName: 'cellar' } },
    ];
    const currentName = editor.getMapName();
    const others = drafts.filter((d) => d.mapName !== currentName);
    const currentSnapshot = editor.buildCrashBackupSnapshot();
    editor.setTabSwitching(true);
    const cleared: string[] = [];
    try {
      for (const draft of others) {
        const loaded = editor.loadFromBackupData({ ...draft.snapshot, timestamp: Date.now() });
        expect(loaded).toBe(true);
        editor.setTabSwitching(false);
        exported.push(`txt:${draft.mapName}`);
        await editor.saveProjectData('/p', { mapName: draft.mapName });
        editor.setTabSwitching(true);
        editor.markAsFullySaved();
        cleared.push(draft.mapName);
      }
    } finally {
      editor.loadFromBackupData({ ...currentSnapshot, timestamp: Date.now() });
      editor.setTabSwitching(false);
    }
    expect(cleared).toEqual(['cellar']);
    expect(exported).toEqual(['load:cellar', 'txt:cellar', 'json:cellar', 'load:hall']);
    expect(editor.markAsFullySaved).toHaveBeenCalledTimes(1);
  });
});
