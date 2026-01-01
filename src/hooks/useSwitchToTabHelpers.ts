import { useEffect } from 'react';
import type { MutableRefObject } from 'react';

export default function useSwitchToTabHelpers(
  switchRef: MutableRefObject<Record<string, unknown> | null>,
  helpers: Record<string, unknown>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useEffect(() => {
    if (!switchRef) return;
    switchRef.current = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handleOpenMap: (helpers as any).handleOpenMap,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loadProjectData: (helpers as any).loadProjectData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setupAutoSave: (helpers as any).setupAutoSave,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      syncMapObjects: (helpers as any).syncMapObjects,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateLayersList: (helpers as any).updateLayersList,
    } as Record<string, unknown>;
  }, [switchRef, helpers]);
}
