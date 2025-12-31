import { useEffect } from 'react';
import type { MutableRefObject } from 'react';

export default function useSwitchToTabHelpers(
  switchRef: MutableRefObject<any>,
  helpers: {
    handleOpenMap: (...args: any[]) => void;
    loadProjectData: (...args: any[]) => Promise<boolean> | boolean;
    setupAutoSave: (editor: any) => void;
    syncMapObjects: () => void;
    updateLayersList: () => void;
  }
) {
  useEffect(() => {
    if (!switchRef) return;
    switchRef.current = {
      handleOpenMap: helpers.handleOpenMap,
      loadProjectData: helpers.loadProjectData,
      setupAutoSave: helpers.setupAutoSave,
      syncMapObjects: helpers.syncMapObjects,
      updateLayersList: helpers.updateLayersList,
    };
  }, [switchRef, helpers.handleOpenMap, helpers.loadProjectData, helpers.setupAutoSave, helpers.syncMapObjects, helpers.updateLayersList]);
}
