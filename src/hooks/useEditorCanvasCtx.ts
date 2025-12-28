// Small helper hook to assemble the EditorCanvas `ctx` and `bottomToolbarProps`.
// Define a concrete (but permissive) dependency interface to avoid `any`.
import type React from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { NpcDeletePopup } from '@/hooks/useEditorState';
import type { StampMode } from '@/types';

type UiHelpers = {
  tooltip?: unknown;
  showTooltipWithDelay?: (content: React.ReactNode, el: HTMLElement) => void;
  hideTooltip?: () => void;
  toolbarRef?: React.RefObject<HTMLDivElement> | null;
  canvasRef?: React.RefObject<HTMLCanvasElement> | null;
};

type StampsState = unknown;

type UseEditorCanvasDeps = {
  editor: TileMapEditor | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  draggingNpcId: number | null;
  setDraggingNpcId: React.Dispatch<React.SetStateAction<number | null>>;
  tipsMinimized: boolean;
  setTipsMinimized: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHelp: (b: boolean) => void;
  isEnemyTabActive: boolean;
  mapWidth: number;
  mapHeight: number;
  handlePlaceActorOnMap: (objectId: number, x?: number, y?: number) => void;
  mapInitialized: boolean;
  handleOpenCreateMapDialog: () => Promise<void> | void;
  isPreparingNewMap: boolean;
  hoverCoords: { x: number; y: number } | null;
  showActiveGid: boolean;
  npcDeletePopup: NpcDeletePopup;
  setNpcDeletePopup: (p: NpcDeletePopup) => void;
  handleUnplaceActorFromMap: (objectId: number) => void;
  npcHoverTooltip: { x: number; y: number } | null;
  uiHelpers: UiHelpers | null;
  stampsState: StampsState;
  hasSelection: boolean;
  selectionCount: number;
  handleFillSelection: () => void;
  handleDeleteSelection: () => void;
  handleClearSelection: () => void;
  leftTransitioning: boolean;

  // bottom toolbar
  bottomToolbarExpanded: boolean;
  setBottomToolbarNode: (n: HTMLDivElement | null) => void;
  handleBottomToolbarMouseEnter: () => void;
  handleBottomToolbarMouseLeave: () => void;
  handleBottomToolbarFocus: () => void;
  handleBottomToolbarBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  selectedTool: 'brush' | 'selection' | 'shape' | 'eyedropper' | 'stamp';
  handleSelectTool: (tool: 'brush' | 'selection' | 'shape' | 'stamp' | 'eyedropper') => void;
  showBrushOptions: boolean;
  handleShowBrushOptions: () => void;
  handleHideBrushOptions: () => void;
  selectedBrushTool: 'brush' | 'bucket' | 'eraser' | 'clear';
  setSelectedBrushTool: React.Dispatch<React.SetStateAction<'brush' | 'bucket' | 'eraser' | 'clear'>>;
  showTooltipWithDelayFn: (content: React.ReactNode, el: HTMLElement) => void;
  hideTooltipFn: () => void;
  setShowClearLayerDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showSelectionOptions: boolean;
  handleShowSelectionOptions: () => void;
  handleHideSelectionOptions: () => void;
  selectedSelectionTool: 'rectangular' | 'magic-wand' | 'same-tile' | 'circular';
  setSelectedSelectionTool: React.Dispatch<React.SetStateAction<'rectangular' | 'magic-wand' | 'same-tile' | 'circular'>>;
  showShapeOptions: boolean;
  handleShowShapeOptions: () => void;
  handleHideShapeOptions: () => void;
  selectedShapeTool: 'rectangle' | 'circle' | 'line';
  setSelectedShapeTool: React.Dispatch<React.SetStateAction<'rectangle' | 'circle' | 'line'>>;
  stampMode: StampMode;
  setStampMode: React.Dispatch<React.SetStateAction<StampMode>>;
  newStampName: string;
  setNewStampName: React.Dispatch<React.SetStateAction<string>>;
  handleCreateStamp: () => void;
  stamps: unknown[];
  selectedStamp: string | null;
  handleStampSelect: (stampId: string) => void;
  handleDeleteStamp: (stampId: string) => void;
};

export default function useEditorCanvasCtx(deps: UseEditorCanvasDeps) {
  const ctx = {
    editor: deps.editor,
    canvasRef: deps.canvasRef,
    draggingNpcId: deps.draggingNpcId,
    setDraggingNpcId: deps.setDraggingNpcId,
    tipsMinimized: deps.tipsMinimized,
    setTipsMinimized: deps.setTipsMinimized,
    setShowHelp: deps.setShowHelp,
    isEnemyTabActive: deps.isEnemyTabActive,
    mapWidth: deps.mapWidth,
    mapHeight: deps.mapHeight,
    handlePlaceActorOnMap: deps.handlePlaceActorOnMap,
    mapInitialized: deps.mapInitialized,
    handleOpenCreateMapDialog: deps.handleOpenCreateMapDialog,
    isPreparingNewMap: deps.isPreparingNewMap,
    hoverCoords: deps.hoverCoords,
    showActiveGid: deps.showActiveGid,
    npcDeletePopup: deps.npcDeletePopup,
    setNpcDeletePopup: deps.setNpcDeletePopup,
    handleUnplaceActorFromMap: deps.handleUnplaceActorFromMap,
    npcHoverTooltip: deps.npcHoverTooltip,
    uiHelpers: deps.uiHelpers,
    stampsState: deps.stampsState,
    hasSelection: deps.hasSelection,
    selectionCount: deps.selectionCount,
    handleFillSelection: deps.handleFillSelection,
    handleDeleteSelection: deps.handleDeleteSelection,
    handleClearSelection: deps.handleClearSelection,
    leftTransitioning: deps.leftTransitioning
  };

  const bottomToolbarProps = {
    bottomToolbarExpanded: deps.bottomToolbarExpanded,
    setBottomToolbarNode: deps.setBottomToolbarNode,
    onMouseEnter: deps.handleBottomToolbarMouseEnter,
    onMouseLeave: deps.handleBottomToolbarMouseLeave,
    onFocus: deps.handleBottomToolbarFocus,
    onBlur: deps.handleBottomToolbarBlur,
    selectedTool: deps.selectedTool,
    handleSelectTool: deps.handleSelectTool,
    showBrushOptions: deps.showBrushOptions,
    handleShowBrushOptions: deps.handleShowBrushOptions,
    handleHideBrushOptions: deps.handleHideBrushOptions,
    selectedBrushTool: deps.selectedBrushTool,
    setSelectedBrushTool: deps.setSelectedBrushTool,
    showTooltipWithDelay: deps.showTooltipWithDelayFn,
    hideTooltip: deps.hideTooltipFn,
    setShowClearLayerDialog: deps.setShowClearLayerDialog,
    showSelectionOptions: deps.showSelectionOptions,
    handleShowSelectionOptions: deps.handleShowSelectionOptions,
    handleHideSelectionOptions: deps.handleHideSelectionOptions,
    selectedSelectionTool: deps.selectedSelectionTool,
    setSelectedSelectionTool: deps.setSelectedSelectionTool,
    showShapeOptions: deps.showShapeOptions,
    handleShowShapeOptions: deps.handleShowShapeOptions,
    handleHideShapeOptions: deps.handleHideShapeOptions,
    selectedShapeTool: deps.selectedShapeTool,
    setSelectedShapeTool: deps.setSelectedShapeTool,
    stampMode: deps.stampMode,
    setStampMode: deps.setStampMode,
    newStampName: deps.newStampName,
    setNewStampName: deps.setNewStampName,
    handleCreateStamp: deps.handleCreateStamp,
    stamps: deps.stamps,
    selectedStamp: deps.selectedStamp,
    handleStampSelect: deps.handleStampSelect,
    handleDeleteStamp: deps.handleDeleteStamp,
    stampsState: deps.stampsState
  };

  return { ctx, bottomToolbarProps };
}
