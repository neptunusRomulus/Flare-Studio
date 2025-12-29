import React, { useCallback } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type BrushTool = 'brush' | 'bucket' | 'eraser' | 'clear';

export default function useClearLayerHandler(args: { editor?: TileMapEditor | null; setSelectedBrushTool: React.Dispatch<React.SetStateAction<BrushTool>>; setShowClearLayerDialog: React.Dispatch<React.SetStateAction<boolean>>; }) {
  const { editor, setSelectedBrushTool, setShowClearLayerDialog } = args;

  const handleClearLayerClose = useCallback(() => setShowClearLayerDialog(false), [setShowClearLayerDialog]);

  const handleClearLayerConfirm = useCallback(() => {
    try {
      const ed = editor as (TileMapEditor & { clearLayer?: () => void }) | null | undefined;
      if (ed && typeof ed.clearLayer === 'function') ed.clearLayer();
    } catch {
      // ignore
    }
    setSelectedBrushTool('brush');
    setShowClearLayerDialog(false);
  }, [editor, setSelectedBrushTool, setShowClearLayerDialog]);

  return { handleClearLayerClose, handleClearLayerConfirm };
}
