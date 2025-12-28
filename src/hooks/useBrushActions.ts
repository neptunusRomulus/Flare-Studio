import { useCallback } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { Dispatch, SetStateAction } from 'react';

type ConfirmPayload = { layerType: string; tabId: number };

type ConfirmAction = null | { type: 'removeBrush' | 'removeTileset' | 'removeTab'; payload?: number | ConfirmPayload };

type UseBrushActionsOptions = {
  editor: TileMapEditor | null;
  setConfirmAction: Dispatch<SetStateAction<ConfirmAction>>;
};

export default function useBrushActions({ editor, setConfirmAction }: UseBrushActionsOptions) {
  const removeBrush = useCallback((brushId: number) => {
    if (!editor) return;
    setConfirmAction({ type: 'removeBrush', payload: brushId });
  }, [editor, setConfirmAction]);

  const reorderBrush = useCallback((fromTileIndex: number, toTileIndex: number) => {
    if (!editor) return;
    try {
      const tileInfo: Array<{ gid: number; width: number; height: number; sourceX: number; sourceY: number }> = editor.getDetectedTileInfo ? editor.getDetectedTileInfo() : [];
      const fromIndex = tileInfo.findIndex((tile) => tile.gid === fromTileIndex);
      const toIndex = tileInfo.findIndex((tile) => tile.gid === toTileIndex);
      if (fromIndex !== -1 && toIndex !== -1 && typeof editor.reorderBrush === 'function') {
        editor.reorderBrush(fromIndex, toIndex);
      }
    } catch (err) {
      console.error('Failed to reorder brush:', err);
    }
  }, [editor]);

  return { removeBrush, reorderBrush };
}
