import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type UseNpcDragOptions = {
  editor: TileMapEditor | null;
  setDraggingNpcId: Dispatch<SetStateAction<number | null>>;
};

export default function useNpcDrag({ editor, setDraggingNpcId }: UseNpcDragOptions) {
  const handleNpcDragStart = useCallback((e: React.DragEvent, npcId: number) => {
    e.dataTransfer.setData('npc-id', npcId.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggingNpcId(npcId);
  }, [setDraggingNpcId]);

  const handleNpcDragEnd = useCallback(() => {
    if (editor) {
      const ed = editor as unknown as { clearNpcDragHover?: () => void };
      if (typeof ed.clearNpcDragHover === 'function') {
        try { ed.clearNpcDragHover(); } catch { /* ignore */ }
      }
    }
    setDraggingNpcId(null);
  }, [editor, setDraggingNpcId]);

  return { handleNpcDragStart, handleNpcDragEnd };
}
