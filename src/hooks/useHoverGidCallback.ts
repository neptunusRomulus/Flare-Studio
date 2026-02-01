import { useEffect } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

export default function useHoverGidCallback(
  editor?: TileMapEditor | null,
  hoverCoords?: { x: number; y: number } | null,
  setHoverGidValue?: (s: string) => void
) {
  useEffect(() => {
    if (!editor || !hoverCoords || !setHoverGidValue) {
      setHoverGidValue?.('(none)');
      return;
    }

    const gid = editor.getGidAt?.(hoverCoords.x, hoverCoords.y);
    if (typeof gid === 'number') {
      setHoverGidValue(gid > 0 ? gid.toString() : '(empty)');
    }
  }, [editor, hoverCoords?.x, hoverCoords?.y, setHoverGidValue]);
}
