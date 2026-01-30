import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TileMapEditor } from '../editor/TileMapEditor';
import { useSaveQueue } from '@/context/SaveQueueContext';

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
  const { waitForAllSaves } = useSaveQueue();
  
  useEffect(() => { hasUnsavedRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      type EditorAPI = {
        onMenuSaveMap?: (cb: () => void) => void;
        onMenuOpenMap?: (cb: () => void) => void;
        selectDirectory?: () => Promise<string | null>;
        onMenuNewMap?: (cb: () => void) => void;
        onMenuUndo?: (cb: () => void) => void;
        onMenuRedo?: (cb: () => void) => void;
        onBeforeClose?: (cb: () => void) => void;
        confirmClose?: (hasUnsaved: boolean) => Promise<void>;
        onSaveAndClose?: (cb: () => void) => void;
        closeAfterSave?: () => void;
      };

      const api = (window as unknown as { electronAPI?: EditorAPI }).electronAPI;
      if (!api) return;

      api.onMenuSaveMap?.(async () => {
        try { await handleManualSaveRef.current?.(); } catch (e) { console.error(e); }
      });

      api.onMenuOpenMap?.(async () => {
        const selected = await api.selectDirectory?.();
        if (selected) {
          try {
            const fn = handleOpenMapRef.current;
            if (fn) await fn(selected);
          } catch (e) {
            console.error(e);
          }
        }
      });

      api.onMenuNewMap?.(() => {
        setShowWelcome(true);
        setMapInitialized(false);
        setEditor(null);
        setMapWidth(0);
        setMapHeight(0);
        setShowCreateMapDialog(false);
      });

      api.onMenuUndo?.(() => { try { handleUndoRef.current?.(); } catch (e) { console.error(e); } });
      api.onMenuRedo?.(() => { try { handleRedoRef.current?.(); } catch (e) { console.error(e); } });

      api.onBeforeClose?.(async () => {
        try {
          await api.confirmClose?.(hasUnsavedRef.current);
        } catch (err) {
          console.error('onBeforeClose handler failed:', err);
        }
      });

      api.onSaveAndClose?.(async () => {
        try {
          await handleManualSaveRef.current?.();
          api.closeAfterSave?.();
        } catch (error) {
          console.error('Failed to save before close:', error);
          api.closeAfterSave?.();
        }
      });

      // Handle graceful shutdown: flush pending saves before app quits
      api.onAppBeforeQuit?.(async () => {
        console.log('[Shutdown] Received app-before-quit event, waiting for all pending saves...');
        try {
          // Wait for all pending saves (with 30 second timeout)
          const result = await waitForAllSaves(30000);
          
          if (result.timedOut) {
            console.warn(`[Shutdown] Save queue timeout! Completed: ${result.completed}, Failed: ${result.failed}`);
          } else {
            console.log(`[Shutdown] All saves flushed. Completed: ${result.completed}, Failed: ${result.failed}`);
          }
          
          // Also trigger one final manual save to be safe
          try {
            await handleManualSaveRef.current?.();
            console.log('[Shutdown] Final manual save completed');
          } catch (err) {
            console.error('[Shutdown] Final manual save failed:', err);
          }
        } catch (error) {
          console.error('[Shutdown] Error during save flush:', error);
        } finally {
          // Always notify main process we're done, even if saves failed
          console.log('[Shutdown] Notifying main process shutdown is complete');
          api.appShutdownComplete?.();
        }
      });
    } catch (err) {
      console.warn('useEditorIpc: failed to register some listeners', err);
    }

    // Intentionally no dependencies so listeners register once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
