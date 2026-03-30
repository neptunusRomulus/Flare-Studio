// Small helper hook to assemble the EditorCanvas `ctx` and `bottomToolbarProps`.
// Define a concrete (but permissive) dependency interface to avoid `any`.
import type React from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { NpcDeletePopup } from '@/hooks/useEditorState';
import type { StampMode, Stamp } from '@/types';

type UiHelpers = {
  tooltip?: unknown;
  showTooltipWithDelay: (content: React.ReactNode, el: HTMLElement) => void;
  hideTooltip: () => void;
  toolbarRef: React.RefObject<HTMLDivElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
};

type StampsState = unknown;

type UseEditorCanvasDeps = {
  editor: TileMapEditor | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  draggingNpcId: number | null;
  setDraggingNpcId: React.Dispatch<React.SetStateAction<number | null>>;
  draggingEventId: number | null;
  setDraggingEventId: React.Dispatch<React.SetStateAction<number | null>>;
  tipsMinimized: boolean;
  setTipsMinimized: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHelp: (b: boolean) => void;
  isEnemyTabActive: boolean;
  mapWidth: number;
  mapHeight: number;
  handlePlaceActorOnMap: (objectId: number, x?: number, y?: number) => void;
  handlePlaceEventOnMap: (eventId: string, x: number, y: number) => void;
  mapInitialized: boolean;
  handleOpenCreateMapDialog: () => Promise<void> | void;
  isPreparingNewMap: boolean;
  hoverCoords: { x: number; y: number } | null;
  showActiveGid: boolean;
  activeGidValue: string;
  hoverGidValue: string;
  npcDeletePopup: NpcDeletePopup;
  setNpcDeletePopup: (p: NpcDeletePopup) => void;
  handleUnplaceActorFromMap: (objectId: number) => void;
  npcHoverTooltip: { x: number; y: number } | null;
  uiHelpers: UiHelpers;
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
  selectedSelectionTool: 'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular';
  setSelectedSelectionTool: React.Dispatch<React.SetStateAction<'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular'>>;
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
  stamps: Stamp[];
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
    draggingEventId: deps.draggingEventId,
    setDraggingEventId: deps.setDraggingEventId,
    tipsMinimized: deps.tipsMinimized,
    setTipsMinimized: deps.setTipsMinimized,
    setShowHelp: deps.setShowHelp,
    isEnemyTabActive: deps.isEnemyTabActive,
    mapWidth: deps.mapWidth,
    mapHeight: deps.mapHeight,
    handlePlaceActorOnMap: deps.handlePlaceActorOnMap,
    handlePlaceEventOnMap: deps.handlePlaceEventOnMap,
    mapInitialized: deps.mapInitialized,
    handleOpenCreateMapDialog: deps.handleOpenCreateMapDialog,
    isPreparingNewMap: deps.isPreparingNewMap,
    hoverCoords: deps.hoverCoords,
    showActiveGid: deps.showActiveGid,
    activeGidValue: deps.activeGidValue,
    hoverGidValue: deps.hoverGidValue,
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

  return { ctx };
}
