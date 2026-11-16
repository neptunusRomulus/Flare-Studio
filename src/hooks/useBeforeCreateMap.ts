import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import { resolveSaveMapName } from '@/editor/mapSaveName';
import type { EditorTab } from './useEditorTabs';

export default function useBeforeCreateMap(args: {
  editor?: TileMapEditor | null;
  activeTabId?: string | null;
  tabs?: EditorTab[];
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  currentProjectPath?: string | null;
}) {
  const { editor, activeTabId, tabs, setTabs, currentProjectPath } = args;

  const handleBeforeCreateMap = useCallback(async () => {
    if (!editor || !activeTabId) {
      return;
    }

    try {
      if (typeof editor.ensureTilesetsLoaded === 'function') await editor.ensureTilesetsLoaded();
      const snapshot = await editor.getProjectData();
      const safeSnapshot = JSON.parse(JSON.stringify(snapshot));
      setTabs((prev) => prev.map(t => t.id === activeTabId ? { ...t, config: safeSnapshot } : t));
      if (currentProjectPath) {
        const activeTab = (tabs ?? []).find((t) => t.id === activeTabId);
        const editorName = typeof editor.getMapName === 'function' ? editor.getMapName() : undefined;
        const persistName = resolveSaveMapName(editorName, activeTab?.name);
        await editor.saveProjectData(currentProjectPath, persistName ? { mapName: persistName } : undefined);
      }
    } catch (err) {
      console.warn('Failed to snapshot current tab before creating a new map:', err);
    }
  }, [editor, activeTabId, tabs, setTabs, currentProjectPath]);

  return { handleBeforeCreateMap };
}
