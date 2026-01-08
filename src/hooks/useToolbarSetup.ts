import useToolbarState from './useToolbarState';
import useBrushToolbar from './useBrushToolbar';
import useToolbarHandlers from './useToolbarHandlers';
import type { TileMapEditor } from '@/editor/TileMapEditor';

export default function useToolbarSetup({ editor }: { editor: TileMapEditor | null }) {
  const toolbarState = useToolbarState();

  const {
    setSelectedTool,
    showBottomToolbarTemporarily,
    setBrushTool,
    newStampName,
    setNewStampName,
    setShowStampDialog,
    setStampMode,
    selectedStamp,
    setSelectedStamp,
    setBrushToSeparate,
    setShowSeparateDialog,
    brushToSeparate
  } = toolbarState;

  const { showBrushToolbarTemporarily: showBrushToolbarTemporarilyFallback } = useBrushToolbar();

  const {
    handleSelectTool,
    handleToggleBrushTool,
    handleCreateStamp,
    handleStampSelect,
    handleDeleteStamp,
    handleSeparateBrush,
    confirmSeparateBrush
  } = useToolbarHandlers({
    editor: editor ?? null,
    setSelectedTool,
    showBottomToolbarTemporarily,
    setBrushTool,
    showBrushToolbarTemporarily: showBrushToolbarTemporarilyFallback,
    newStampName,
    setNewStampName,
    setShowStampDialog,
    setStampMode,
    selectedStamp,
    setSelectedStamp,
    setBrushToSeparate,
    setShowSeparateDialog,
    brushToSeparate
  });

  const stampsState = {
    stamps: toolbarState.stamps,
    setStamps: toolbarState.setStamps,
    selectedStamp,
    setSelectedStamp,
    stampMode: toolbarState.stampMode,
    setStampMode,
    setShowStampDialog,
    newStampName,
    setNewStampName,
    handleCreateStamp,
    handleStampSelect,
    handleDeleteStamp,
    handleSeparateBrush,
    confirmSeparateBrush
  };

  return {
    toolbarState,
    stampsState,
    handleSelectTool,
    handleToggleBrushTool,
    handleCreateStamp,
    handleStampSelect,
    handleDeleteStamp,
    handleSeparateBrush,
    confirmSeparateBrush
  };
}
