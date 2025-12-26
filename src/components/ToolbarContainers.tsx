import React from 'react';
import BottomToolbar from '@/components/BottomToolbar';

import type { Dispatch, SetStateAction } from 'react';

type BrushTool = 'brush' | 'bucket' | 'eraser' | 'clear';
type SelectionTool = 'rectangular' | 'magic-wand' | 'same-tile' | 'circular';
type ShapeTool = 'rectangle' | 'circle' | 'line';

type StampEntry = {
  id: string;
  name: string;
  width: number;
  height: number;
};

type Props = {
  bottomToolbarExpanded: boolean;
  setBottomToolbarNode: (n: HTMLDivElement | null) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  selectedTool: 'brush' | 'selection' | 'shape' | 'stamp' | 'eyedropper';
  handleSelectTool: (tool: 'brush' | 'selection' | 'shape' | 'stamp' | 'eyedropper') => void;
  showBrushOptions: boolean;
  handleShowBrushOptions: () => void;
  handleHideBrushOptions: () => void;
  selectedBrushTool: BrushTool;
  setSelectedBrushTool: Dispatch<SetStateAction<BrushTool>>;
  showTooltipWithDelay: (text: React.ReactNode, target: HTMLElement) => void;
  hideTooltip: () => void;
  setShowClearLayerDialog: Dispatch<SetStateAction<boolean>>;
  getBrushIcon: () => React.ReactNode;
  showSelectionOptions: boolean;
  handleShowSelectionOptions: () => void;
  handleHideSelectionOptions: () => void;
  selectedSelectionTool: SelectionTool;
  setSelectedSelectionTool: Dispatch<SetStateAction<SelectionTool>>;
  getSelectionIcon: () => React.ReactNode;
  showShapeOptions: boolean;
  handleShowShapeOptions: () => void;
  handleHideShapeOptions: () => void;
  selectedShapeTool: ShapeTool;
  setSelectedShapeTool: Dispatch<SetStateAction<ShapeTool>>;
  // Shape & stamp extras
  getShapeIcon: () => React.ReactNode;
  stampMode: 'select' | 'create' | 'place';
  setStampMode: Dispatch<SetStateAction<'select' | 'create' | 'place'>>;
  newStampName: string;
  setNewStampName: Dispatch<SetStateAction<string>>;
  handleCreateStamp: () => void;
  stamps: StampEntry[];
  selectedStamp: string | null;
  handleStampSelect: (id: string) => void;
  handleDeleteStamp: (id: string) => void;
};

export default function ToolbarContainers(props: Props) {
  const {
    bottomToolbarExpanded,
    setBottomToolbarNode,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
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
    getBrushIcon,
    showSelectionOptions,
    handleShowSelectionOptions,
    handleHideSelectionOptions,
    selectedSelectionTool,
    setSelectedSelectionTool,
    getSelectionIcon,
    showShapeOptions,
    handleShowShapeOptions,
    handleHideShapeOptions,
    selectedShapeTool,
    setSelectedShapeTool,
    getShapeIcon,
    stampMode,
    setStampMode,
    newStampName,
    setNewStampName,
    handleCreateStamp,
    stamps,
    selectedStamp,
    handleStampSelect,
    handleDeleteStamp
  } = props;

  return (
    <BottomToolbar
      bottomToolbarExpanded={bottomToolbarExpanded}
      setBottomToolbarNode={setBottomToolbarNode}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      selectedTool={selectedTool}
      handleSelectTool={handleSelectTool}
      showBrushOptions={showBrushOptions}
      handleShowBrushOptions={handleShowBrushOptions}
      handleHideBrushOptions={handleHideBrushOptions}
      selectedBrushTool={selectedBrushTool}
      setSelectedBrushTool={setSelectedBrushTool}
      showTooltipWithDelay={showTooltipWithDelay}
      hideTooltip={hideTooltip}
      setShowClearLayerDialog={setShowClearLayerDialog}
      getBrushIcon={getBrushIcon}
      showSelectionOptions={showSelectionOptions}
      handleShowSelectionOptions={handleShowSelectionOptions}
      handleHideSelectionOptions={handleHideSelectionOptions}
      selectedSelectionTool={selectedSelectionTool}
      setSelectedSelectionTool={setSelectedSelectionTool}
      getSelectionIcon={getSelectionIcon}
      showShapeOptions={showShapeOptions}
      handleShowShapeOptions={handleShowShapeOptions}
      handleHideShapeOptions={handleHideShapeOptions}
      selectedShapeTool={selectedShapeTool}
      setSelectedShapeTool={setSelectedShapeTool}
        getShapeIcon={getShapeIcon}
        stampMode={stampMode}
        setStampMode={setStampMode}
        newStampName={newStampName}
        setNewStampName={setNewStampName}
        handleCreateStamp={handleCreateStamp}
        stamps={stamps}
        selectedStamp={selectedStamp}
        handleStampSelect={handleStampSelect}
        handleDeleteStamp={handleDeleteStamp}
      />
  );
}
