import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TileMapEditor } from '../editor/TileMapEditor';

type UseEditorIpcOptions = {
  handleManualSaveRef: React.RefObject<(() => Promise<void>) | undefined>;
  handleOpenMapRef: React.RefObject<((path: string, createTab?: boolean, mapName?: string) => Promise<void>) | undefined>;
  handleUndoRef: React.RefObject<(() => void) | undefined>;
  handleRedoRef: React.RefObject<(() => void) | undefined>;
  setShowWelcome: Dispatch<SetStateAction<boolean>>;
  setMapInitialized: Dispatch<SetStateAction<boolean>>;
  setEditor: Dispatch<SetStateAction<TileMapEditor | null>>;
  setMapWidth: Dispatch<SetStateAction<number>>;
  setMapHeight: Dispatch<SetStateAction<number>>;
  setShowCreateMapDialog: Dispatch<SetStateAction<boolean>>;
  hasUnsavedChanges: boolean;
};

export default function useEditorIpc(opts: UseEditorIpcOptions) {
  const {
    handleManualSaveRef,
    handleOpenMapRef,
    handleUndoRef,
    handleRedoRef,
    setShowWelcome,
    setMapInitialized,
    setEditor,
    setMapWidth,
    setMapHeight,
    setShowCreateMapDialog,
    hasUnsavedChanges
  } = opts;

  const hasUnsavedRef = useRef<boolean>(hasUnsavedChanges);
  useEffect(() => { hasUnsavedRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);

  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) return;

    try {
      const api = (window as any).electronAPI;

      api.onMenuSaveMap(async () => {
        try { await handleManualSaveRef.current?.(); } catch (e) { console.error(e); }
      });

      api.onMenuOpenMap(async () => {
        const selected = await api.selectDirectory();
        if (selected) {
          try {
            const fn = handleOpenMapRef.current;
            if (fn) await fn(selected);
          } catch (e) {
            console.error(e);
          }
        }
      });

      api.onMenuNewMap(() => {
        setShowWelcome(true);
        setMapInitialized(false);
        setEditor(null);
        setMapWidth(0);
        setMapHeight(0);
        setShowCreateMapDialog(false);
      });

      api.onMenuUndo(() => { try { handleUndoRef.current?.(); } catch (e) { console.error(e); } });
      api.onMenuRedo(() => { try { handleRedoRef.current?.(); } catch (e) { console.error(e); } });

      api.onBeforeClose(async () => {
        try {
          await api.confirmClose(hasUnsavedRef.current);
        } catch (err) {
          console.error('onBeforeClose handler failed:', err);
        }
      });

      api.onSaveAndClose(async () => {
        try {
          await handleManualSaveRef.current?.();
          api.closeAfterSave();
        } catch (error) {
          console.error('Failed to save before close:', error);
          api.closeAfterSave();
        }
      });
    } catch (err) {
      console.warn('useEditorIpc: failed to register some listeners', err);
    }

  // Intentionally no dependencies so listeners register once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
