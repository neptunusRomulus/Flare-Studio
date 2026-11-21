import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type UseEventDragOptions = {
  editor: TileMapEditor | null;
  setDraggingEventId: Dispatch<SetStateAction<string | null>>;
};

export default function useEventDrag({ editor, setDraggingEventId }: UseEventDragOptions) {
  const handleEventDragStart = useCallback((e: React.DragEvent, scriptPath: string) => {
    e.dataTransfer.setData('event-script', scriptPath);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggingEventId(scriptPath);
  }, [setDraggingEventId]);

  const handleEventDragEnd = useCallback(() => {
    if (editor) {
      const ed = editor as unknown as { clearEventDragHover?: () => void };
      if (typeof ed.clearEventDragHover === 'function') {
        try { ed.clearEventDragHover(); } catch { /* ignore */ }
      }
    }
    setDraggingEventId(null);
  }, [editor, setDraggingEventId]);

  return { handleEventDragStart, handleEventDragEnd };
}
