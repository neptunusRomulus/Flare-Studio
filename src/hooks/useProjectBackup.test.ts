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
  it('exports every non-current map draft without loading them into the live editor', async () => {
    const { writeInactiveMapDrafts } = await import('@/flare/manualSaveExport');
    const exported: string[] = [];
    const liveEditor = {
      getMapName: () => 'hall',
      loadFromBackupData: vi.fn(),
      saveProjectData: vi.fn(),
      markAsFullySaved: vi.fn(),
      setTabSwitching: vi.fn(),
    };
    const drafts = [
      { mapName: 'hall', snapshot: { mapName: 'hall' } },
      { mapName: 'cellar', snapshot: { mapName: 'cellar', objects: [{ type: 'npc', name: 'Mira' }] } },
    ];
    const cleared: string[] = [];
    const written = await writeInactiveMapDrafts({
      currentMapName: liveEditor.getMapName(),
      projectPath: '/p',
      drafts,
      clearMapDraft: (name) => cleared.push(name),
      exportSnapshot: async (snapshot, projectPath, mapName) => {
        exported.push(`${projectPath}:${mapName}:${(snapshot as { mapName?: string }).mapName}`);
        return true;
      },
    });
    expect(written).toEqual(['cellar']);
    expect(cleared).toEqual(['cellar']);
    expect(exported).toEqual(['/p:cellar:cellar']);
    expect(liveEditor.loadFromBackupData).not.toHaveBeenCalled();
    expect(liveEditor.saveProjectData).not.toHaveBeenCalled();
    expect(liveEditor.markAsFullySaved).not.toHaveBeenCalled();
    expect(liveEditor.setTabSwitching).not.toHaveBeenCalled();
  });
});
