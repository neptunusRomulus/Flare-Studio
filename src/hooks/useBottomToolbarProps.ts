import type React from 'react';
import type { Stamp } from '@/types';

type Params = {
  bottomToolbarExpanded: boolean;
  setBottomToolbarNode: (n: HTMLDivElement | null) => void;
  handleBottomToolbarMouseEnter: () => void;
  handleBottomToolbarMouseLeave: () => void;
  handleBottomToolbarFocus: () => void;
  handleBottomToolbarBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  selectedTool: 'brush' | 'selection' | 'shape' | 'stamp' | 'eyedropper';
  handleSelectTool: (tool: 'brush' | 'selection' | 'shape' | 'stamp' | 'eyedropper') => void;
  showBrushOptions: boolean;
  handleShowBrushOptions: () => void;
  handleHideBrushOptions: () => void;
  selectedBrushTool: 'brush' | 'bucket' | 'eraser' | 'clear';
  setSelectedBrushTool: React.Dispatch<React.SetStateAction<'brush' | 'bucket' | 'eraser' | 'clear'>>;
  showTooltipWithDelay: (content: React.ReactNode, el: HTMLElement) => void;
  hideTooltip: () => void;
  setShowClearLayerDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showSelectionOptions: boolean;
  handleShowSelectionOptions: () => void;
  handleHideSelectionOptions: () => void;
  selectedSelectionTool: 'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular';
  setSelectedSelectionTool: React.Dispatch<React.SetStateAction<'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular'>>;
  showShapeOptions: boolean;
  handleShowShapeOptions: () => void;
  handleHideShapeOptions: () => void;
  selectedShapeTool: 'rectangle' | 'circle' | 'line';
  setSelectedShapeTool: React.Dispatch<React.SetStateAction<'rectangle' | 'circle' | 'line'>>;
  stampMode: 'select' | 'create' | 'place';
  setStampMode: React.Dispatch<React.SetStateAction<'select' | 'create' | 'place'>>;
  newStampName: string;
  setNewStampName: React.Dispatch<React.SetStateAction<string>>;
  handleCreateStamp: () => void;
  stamps: Stamp[];
  selectedStamp: string | null;
  handleStampSelect: (id: string) => void;
  handleDeleteStamp: (id: string) => void;
  stampsState?: unknown;
};

export default function useBottomToolbarProps(params: Params) {
  const {
    bottomToolbarExpanded,
    setBottomToolbarNode,
    handleBottomToolbarMouseEnter,
    handleBottomToolbarMouseLeave,
    handleBottomToolbarFocus,
    handleBottomToolbarBlur,
    selectedTool,
    handleSelectTool,
    showBrushOptions,
    handleShowBrushOptions,
    handleHideBrushOptions,
    selectedBrushTool,
    setSelectedBrushTool,
    showTooltipWithDelay,
    hideTooltip,
    setShowClearLayerDialog,
    showSelectionOptions,
    handleShowSelectionOptions,
    handleHideSelectionOptions,
    selectedSelectionTool,
    setSelectedSelectionTool,
    showShapeOptions,
    handleShowShapeOptions,
    handleHideShapeOptions,
    selectedShapeTool,
    setSelectedShapeTool,
    stampMode,
    setStampMode,
    newStampName,
    setNewStampName,
    handleCreateStamp,
    stamps,
    selectedStamp,
    handleStampSelect,
    handleDeleteStamp,
    stampsState
  } = params;

  return {
    bottomToolbarExpanded,
    setBottomToolbarNode,
    onMouseEnter: handleBottomToolbarMouseEnter,
    onMouseLeave: handleBottomToolbarMouseLeave,
    onFocus: handleBottomToolbarFocus,
    onBlur: handleBottomToolbarBlur,
    selectedTool,
    handleSelectTool,
    showBrushOptions,
    handleShowBrushOptions,
    handleHideBrushOptions,
    selectedBrushTool,
    setSelectedBrushTool,
    showTooltipWithDelay,
    hideTooltip,
    setShowClearLayerDialog,
    showSelectionOptions,
    handleShowSelectionOptions,
    handleHideSelectionOptions,
    selectedSelectionTool,
    setSelectedSelectionTool,
    showShapeOptions,
    handleShowShapeOptions,
    handleHideShapeOptions,
    selectedShapeTool,
    setSelectedShapeTool,
    stampMode,
    setStampMode,
    newStampName,
    setNewStampName,
    handleCreateStamp,
    stamps,
    selectedStamp,
    handleStampSelect,
    handleDeleteStamp,
    stampsState
  };
}
