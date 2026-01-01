import { useEffect } from 'react';
import type { TileMapEditor } from '../editor/TileMapEditor';

type Props = {
  editor: TileMapEditor | null;
  selectedTool: string;
  selectedBrushTool: string;
  selectedSelectionTool: string;
  selectedShapeTool: string;
  stampMode: string | null;
  selectedStamp: unknown;
  setSelectionCount: (n: number) => void;
  setHasSelection: (v: boolean) => void;
};

export default function useEditorToolSync({
  editor,
  selectedTool,
  selectedBrushTool,
  selectedSelectionTool,
  selectedShapeTool,
  stampMode,
  selectedStamp,
  setSelectionCount,
  setHasSelection
}: Props) {
  useEffect(() => {
    if (!editor) return;

    if (selectedTool === 'brush') {
      const toolMap: { [key: string]: 'brush' | 'eraser' | 'bucket' } = {
        brush: 'brush',
        bucket: 'bucket',
        eraser: 'eraser'
      };
      const editorTool = toolMap[selectedBrushTool] || 'brush';
      editor.setCurrentTool(editorTool);
      return;
    }

    if (selectedTool === 'selection') {
      const selectionToolMap: { [key: string]: 'rectangular' | 'magic-wand' | 'same-tile' | 'circular' } = {
        rectangular: 'rectangular',
        'magic-wand': 'magic-wand',
        'same-tile': 'same-tile',
        circular: 'circular'
      };
      const editorSelectionTool = selectionToolMap[selectedSelectionTool] || 'rectangular';
      editor.setCurrentSelectionTool(editorSelectionTool);
      return;
    }

    if (selectedTool === 'shape') {
      const shapeToolMap: { [key: string]: 'rectangle' | 'circle' | 'line' } = {
        rectangle: 'rectangle',
        circle: 'circle',
        line: 'line'
      };
      const editorShapeTool = shapeToolMap[selectedShapeTool] || 'rectangle';
      editor.setCurrentShapeTool(editorShapeTool);
      return;
    }

    if (selectedTool === 'eyedropper') {
      editor.setEyedropperTool();
      return;
    }

    if (selectedTool === 'stamp') {
      editor.setStampTool();
      return;
    }
  }, [editor, selectedTool, selectedBrushTool, selectedSelectionTool, selectedShapeTool]);

  useEffect(() => {
    if (!editor || selectedTool !== 'stamp') return;
    if (stampMode == null) return;
    editor.setCurrentStampMode(stampMode as 'select' | 'create' | 'place');
  }, [editor, selectedTool, stampMode]);

  useEffect(() => {
    if (!editor || selectedTool !== 'stamp') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.setActiveStamp(selectedStamp as any);
  }, [editor, selectedTool, selectedStamp]);

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
