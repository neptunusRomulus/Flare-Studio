import { useRef } from 'react';
import type { TileMapEditor } from '../editor/TileMapEditor';

export default function useEditorRefs() {
  const editorOptsRef = useRef<Record<string, unknown> | null>(null);
  const handleManualSaveRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const switchToTabHelpersRef = useRef<{
    handleOpenMap: (...args: any[]) => Promise<void>;
    loadProjectData: (...args: any[]) => Promise<boolean>;
    setupAutoSave: (editor: TileMapEditor) => void;
    syncMapObjects: () => void;
    updateLayersList: () => void;
  }>({
    handleOpenMap: async () => {},
    loadProjectData: async () => false,
    setupAutoSave: () => {},
    syncMapObjects: () => {},
    updateLayersList: () => {},
  });

  return { editorOptsRef, handleManualSaveRef, switchToTabHelpersRef };
}
