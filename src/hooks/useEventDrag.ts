import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type UseEventDragOptions = {
  editor: TileMapEditor | null;
  setDraggingEventId: Dispatch<SetStateAction<string | null>>;
};

export default function useEventDrag({ editor, setDraggingEventId }: UseEventDragOptions) {
  const handleEventDragStart = useCallback((e: React.DragEvent, eventId: string) => {
    e.dataTransfer.setData('event-id', eventId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingEventId(eventId);
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
