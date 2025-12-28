import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TileMapEditor } from '../editor/TileMapEditor';

type UseHoverAndSelectionParams = {
  editor: TileMapEditor | null;
  setHoverCoords: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setSelectionCount: Dispatch<SetStateAction<number>>;
  setHasSelection: Dispatch<SetStateAction<boolean>>;
};

export default function useHoverAndSelection({ editor, setHoverCoords, setSelectionCount, setHasSelection }: UseHoverAndSelectionParams) {
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
  }, [editor, setHoverCoords]);

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
  }, [editor, setSelectionCount, setHasSelection]);
}
