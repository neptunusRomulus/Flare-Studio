import { useCallback } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type ToolHandlersOptions = {
  editor: TileMapEditor | null;
  setSelectedTool: (tool: 'brush' | 'selection' | 'shape' | 'stamp' | 'eyedropper') => void;
  showBottomToolbarTemporarily: () => void;
  setBrushTool: (next: 'none' | 'move' | 'merge' | 'separate' | 'remove' | ((prev: 'none' | 'move' | 'merge' | 'separate' | 'remove') => 'none' | 'move' | 'merge' | 'separate' | 'remove')) => void;
  showBrushToolbarTemporarily: () => void;
  newStampName: string;
  setNewStampName: (value: string) => void;
  setShowStampDialog: (open: boolean) => void;
  setStampMode: (mode: 'select' | 'create' | 'place') => void;
  selectedStamp: string | null;
  setSelectedStamp: (value: string | null) => void;
  setBrushToSeparate: (value: number | null) => void;
  setShowSeparateDialog: (open: boolean) => void;
  brushToSeparate: number | null;
};

const useToolbarHandlers = ({
  editor,
  setSelectedTool,
  showBottomToolbarTemporarily,
  setBrushTool,
  showBrushToolbarTemporarily,
  newStampName,
  setNewStampName,
  setShowStampDialog,
  setStampMode,
  selectedStamp,
  setSelectedStamp,
  setBrushToSeparate,
  setShowSeparateDialog,
  brushToSeparate
}: ToolHandlersOptions) => {
  const handleSelectTool = useCallback((tool: 'brush' | 'selection' | 'shape' | 'stamp' | 'eyedropper') => {
    setSelectedTool(tool);
    showBottomToolbarTemporarily();
  }, [setSelectedTool, showBottomToolbarTemporarily]);

  const handleToggleBrushTool = useCallback((tool: 'move' | 'merge' | 'separate' | 'remove') => {
    setBrushTool((current) => (current === tool ? 'none' : tool));
    showBrushToolbarTemporarily();
  }, [setBrushTool, showBrushToolbarTemporarily]);

  const handleCreateStamp = useCallback(() => {
    if (!editor || !newStampName.trim()) return;

    const success = editor.createStampFromSelection(newStampName.trim());
    if (success) {
      setNewStampName('');
      setShowStampDialog(false);
      setStampMode('select');
    }
  }, [editor, newStampName, setNewStampName, setShowStampDialog, setStampMode]);

  const handleStampSelect = useCallback((stampId: string) => {
    setSelectedStamp(stampId);
    setStampMode('place');
  }, [setSelectedStamp, setStampMode]);

  const handleDeleteStamp = useCallback((stampId: string) => {
    if (!editor) return;
    editor.deleteStamp(stampId);
    if (selectedStamp === stampId) {
      setSelectedStamp(null);
      setStampMode('select');
    }
  }, [editor, selectedStamp, setSelectedStamp, setStampMode]);

  const handleSeparateBrush = useCallback((brushId: number) => {
    setBrushToSeparate(brushId);
    setShowSeparateDialog(true);
  }, [setBrushToSeparate, setShowSeparateDialog]);

  const confirmSeparateBrush = useCallback(() => {
    if (!editor || brushToSeparate === null) return;

    try {
      editor.separateBrush(brushToSeparate);
      console.log(`Separated brush with ID: ${brushToSeparate}`);
    } catch (error) {
      console.error('Failed to separate brush:', error);
    }

    setShowSeparateDialog(false);
    setBrushToSeparate(null);
    setBrushTool('none');
  }, [brushToSeparate, editor, setBrushTool, setBrushToSeparate, setShowSeparateDialog]);

  return {
    handleSelectTool,
    handleToggleBrushTool,
    handleCreateStamp,
    handleStampSelect,
    handleDeleteStamp,
    handleSeparateBrush,
    confirmSeparateBrush
  };
};

export default useToolbarHandlers;
