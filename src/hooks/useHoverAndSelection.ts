import { useEffect, useState } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

export function useHoverAndSelection(editor: TileMapEditor | null) {
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const [selectionCount, setSelectionCount] = useState<number>(0);
  const [hasSelection, setHasSelection] = useState<boolean>(false);

  useEffect(() => {
    if (!editor) return;

    const updateHoverCoords = () => {
      const coords = editor.getHoverCoordinates();
      setHoverCoords(coords);
    };

    let animationFrameId: number;
    const pollHoverCoords = () => {
      updateHoverCoords();
      animationFrameId = requestAnimationFrame(pollHoverCoords);
    };

    pollHoverCoords();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      const selection = editor.getSelection();
      const hasActiveSelection = editor.hasActiveSelection();
      setSelectionCount(selection.length);
      setHasSelection(hasActiveSelection);
    };

    const intervalId = setInterval(updateSelection, 100);
    return () => clearInterval(intervalId);
  }, [editor]);

  return { hoverCoords, setHoverCoords, selectionCount, setSelectionCount, hasSelection, setHasSelection };
}
