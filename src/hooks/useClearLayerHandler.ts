import React, { useCallback } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

export default function useClearLayerHandler(args: { editor?: TileMapEditor | null; setSelectedBrushTool: React.Dispatch<React.SetStateAction<any>>; setShowClearLayerDialog: React.Dispatch<React.SetStateAction<boolean>>; }) {
  const { editor, setSelectedBrushTool, setShowClearLayerDialog } = args;

  const handleClearLayerClose = useCallback(() => setShowClearLayerDialog(false), [setShowClearLayerDialog]);

  const handleClearLayerConfirm = useCallback(() => {
    if (editor && typeof (editor as any).clearLayer === 'function') editor.clearLayer();
    setSelectedBrushTool('brush');
    setShowClearLayerDialog(false);
  }, [editor, setSelectedBrushTool, setShowClearLayerDialog]);

  return { handleClearLayerClose, handleClearLayerConfirm };
}
