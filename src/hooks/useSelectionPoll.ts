import { useEffect } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

export default function useSelectionPoll(args: {
  editor?: TileMapEditor | null;
  setSelectionCount: (n: number) => void;
  setHasSelection: (v: boolean) => void;
}) {
  const { editor, setSelectionCount, setHasSelection } = args;

  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      try {
        const selection = editor.getSelection ? editor.getSelection() : [];
        const hasActiveSelection = editor.hasActiveSelection ? editor.hasActiveSelection() : false;
        setSelectionCount(selection.length);
        setHasSelection(hasActiveSelection);
      } catch (err) {
        // ignore
      }
    };

    const intervalId = setInterval(updateSelection, 100);
    return () => clearInterval(intervalId);
  }, [editor, setSelectionCount, setHasSelection]);
}
