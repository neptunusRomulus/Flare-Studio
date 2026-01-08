import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type SwitchHelpers = {
  handleOpenMap: (...args: unknown[]) => Promise<void>;
  loadProjectData: (...args: unknown[]) => Promise<boolean>;
  setupAutoSave: (editor: TileMapEditor) => void;
  syncMapObjects: () => void;
  updateLayersList: () => void;
};

export default function useSwitchToTabHelpers(
  switchRef: MutableRefObject<SwitchHelpers | null>,
  helpers: SwitchHelpers
) {
  useEffect(() => {
    if (!switchRef) return;
    switchRef.current = {
      handleOpenMap: helpers.handleOpenMap,
      loadProjectData: helpers.loadProjectData,
      setupAutoSave: helpers.setupAutoSave,
      syncMapObjects: helpers.syncMapObjects,
      updateLayersList: helpers.updateLayersList,
    } as SwitchHelpers;
  }, [switchRef, helpers]);
}
