import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { EditorTab } from './useEditorTabs';

export default function useBeforeCreateMap(args: {
  editor?: TileMapEditor | null;
  activeTabId?: string | null;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  currentProjectPath?: string | null;
}) {
  const { editor, activeTabId, setTabs, currentProjectPath } = args;

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
        await editor.saveProjectData(currentProjectPath);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed to snapshot current tab before creating a new map:', err);
    }
  }, [editor, activeTabId, setTabs, currentProjectPath]);

  return { handleBeforeCreateMap };
}
