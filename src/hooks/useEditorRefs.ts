import { useRef } from 'react';
import type { TileMapEditor } from '../editor/TileMapEditor';

export default function useEditorRefs() {
  const editorOptsRef = useRef<Record<string, unknown> | null>(null);
  const handleManualSaveRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const switchToTabHelpersRef = useRef<{
    handleOpenMap: (...args: unknown[]) => Promise<void>;
    loadProjectData: (...args: unknown[]) => Promise<boolean>;
    setupAutoSave: (editor: TileMapEditor) => void;
    syncMapObjects: () => void;
    updateLayersList: () => void;
    setTabTick: (fn?: (() => void)) => void;
  }>({
    handleOpenMap: async () => {},
    loadProjectData: async () => false,
    setupAutoSave: () => {},
    syncMapObjects: () => {},
    updateLayersList: () => {},
    setTabTick: () => {},
  });

  return { editorOptsRef, handleManualSaveRef, switchToTabHelpersRef };
}
