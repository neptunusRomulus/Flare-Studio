import useToolbarState from './useToolbarState';
import useBrushToolbar from './useBrushToolbar';
import useToolbarHandlers from './useToolbarHandlers';

export default function useToolbarSetup({ editor }: { editor: any }) {
  const toolbarState = useToolbarState();

  const {
    toolbarControls,
    brushToolbarControls,
    bottomToolbarControls,
    toolbarExpanded,
    toolbarContainerRef,
    handleToolbarMouseEnter,
    handleToolbarMouseLeave,
    handleToolbarFocus,
    handleToolbarBlur,
    bottomToolbarExpanded,
    setBottomToolbarNode,
    handleBottomToolbarMouseEnter,
    handleBottomToolbarMouseLeave,
    handleBottomToolbarFocus,
    handleBottomToolbarBlur,
    showToolbarTemporarily,
    showBottomToolbarTemporarily,
    selectedTool,
    setSelectedTool,
    selectedBrushTool,
    setSelectedBrushTool,
    selectedSelectionTool,
    setSelectedSelectionTool,
    selectedShapeTool,
    setSelectedShapeTool,
    hoverCoords,
    setHoverCoords,
    selectionCount,
    setSelectionCount,
    hasSelection,
    setHasSelection,
    showBrushOptions,
    handleShowBrushOptions,
    handleHideBrushOptions,
    showSelectionOptions,
    handleShowSelectionOptions,
    handleHideSelectionOptions,
    showShapeOptions,
    handleShowShapeOptions,
    handleHideShapeOptions,
    stamps,
    setStamps,
    selectedStamp,
    setSelectedStamp,
    stampMode,
    setStampMode,
    setShowStampDialog,
    newStampName,
    setNewStampName,
    brushTool,
    setBrushTool,
    showSeparateDialog,
    setShowSeparateDialog,
    brushToSeparate,
    setBrushToSeparate
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
    editor,
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
    stamps,
    setStamps,
    selectedStamp,
    setSelectedStamp,
    stampMode,
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
