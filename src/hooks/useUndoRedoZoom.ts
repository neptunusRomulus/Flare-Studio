import { useCallback } from 'react';
import type { TileMapEditor } from '../editor/TileMapEditor';

type Params = {
  editor: TileMapEditor | null;
  updateLayersList: () => void;
  syncMapObjects: () => void;
};

export default function useUndoRedoZoom({ editor, updateLayersList, syncMapObjects }: Params) {
  const handleUndo = useCallback(() => {
    if (editor?.undo) {
      editor.undo();
      try { updateLayersList(); } catch (e) { console.warn('updateLayersList failed after undo', e); }
      try { syncMapObjects(); } catch (e) { console.warn('syncMapObjects failed after undo', e); }
    }
  }, [editor, updateLayersList, syncMapObjects]);

  const handleRedo = useCallback(() => {
    if (editor?.redo) {
      editor.redo();
      try { updateLayersList(); } catch (e) { console.warn('updateLayersList failed after redo', e); }
      try { syncMapObjects(); } catch (e) { console.warn('syncMapObjects failed after redo', e); }
    }
  }, [editor, updateLayersList, syncMapObjects]);

  const handleZoomIn = useCallback(() => {
    if (editor?.zoomIn) editor.zoomIn();
  }, [editor]);

  const handleZoomOut = useCallback(() => {
    if (editor?.zoomOut) editor.zoomOut();
  }, [editor]);

  const handleResetZoom = useCallback(() => {
    if (editor?.resetZoom) editor.resetZoom();
  }, [editor]);

  return { handleUndo, handleRedo, handleZoomIn, handleZoomOut, handleResetZoom };
}
