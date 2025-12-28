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

  // Keep a ref of hasUnsavedChanges so handlers registered once can read latest value
  const hasUnsavedRef = useRef<boolean>(hasUnsavedChanges);
  useEffect(() => { hasUnsavedRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    try {
      window.electronAPI.onMenuSaveMap(async () => {
        try { await handleManualSaveRef.current?.(); } catch (e) { console.error(e); }
      });

      window.electronAPI.onMenuOpenMap(async () => {
        const selected = await window.electronAPI.selectDirectory();
        if (selected) {
          try {
            const fn = handleOpenMapRef.current;
            if (fn) await fn(selected);
          } catch (e) {
            console.error(e);
          }
        }
      });

      window.electronAPI.onMenuNewMap(() => {
        setShowWelcome(true);
        setMapInitialized(false);
        setEditor(null);
        setMapWidth(0);
        setMapHeight(0);
        setShowCreateMapDialog(false);
      });

      window.electronAPI.onMenuUndo(() => { try { handleUndoRef.current?.(); } catch (e) { console.error(e); } });
      window.electronAPI.onMenuRedo(() => { try { handleRedoRef.current?.(); } catch (e) { console.error(e); } });

      // Close / save-on-close handlers
      window.electronAPI.onBeforeClose(async () => {
        try {
          await window.electronAPI.confirmClose(hasUnsavedRef.current);
        } catch (err) {
          console.error('onBeforeClose handler failed:', err);
        }
      });

      window.electronAPI.onSaveAndClose(async () => {
        try {
          await handleManualSaveRef.current?.();
          window.electronAPI.closeAfterSave();
        } catch (error) {
          console.error('Failed to save before close:', error);
          window.electronAPI.closeAfterSave();
        }
      });
    } catch (err) {
      console.warn('useEditorIpc: failed to register some listeners', err);
    }

    // Intentionally no dependencies so listeners register once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
