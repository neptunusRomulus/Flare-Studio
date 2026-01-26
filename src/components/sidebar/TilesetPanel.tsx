import React, { useState, useCallback } from 'react';
import TilesetPalette from '@/components/TilesetPalette';
import BrushToolbar from '@/components/BrushToolbar';
import type { TileLayer } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';

import useTileset from '@/hooks/useTileset';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

type Props = {
  editor: TileMapEditor | null;
  activeLayer: TileLayer | null;
  tabTick: number;
  setTabTick: React.Dispatch<React.SetStateAction<number>>;
  brushTool: 'none' | 'move' | 'merge' | 'separate' | 'remove';
  isCollisionLayer: boolean;
  _brushToolbarExpanded?: boolean;
  _showBrushToolbarTemporarily?: () => void;
  _setBrushToolbarNode?: (n: HTMLDivElement | null) => void;
  handleFileUpload?: (event: React.ChangeEvent<HTMLInputElement>, type: 'tileset' | 'layerTileset') => void;
  handleToggleBrushTool: (tool: 'move' | 'merge' | 'separate' | 'remove') => void;
  handleDeleteActiveTab?: () => void;
  toast: typeof import('@/hooks/use-toast').toast;
  handleOpenActorDialog: (type: 'npc' | 'enemy') => void;
  stampsState?: unknown;
};

const TilesetPanel: React.FC<Props> = ({
  editor,
  activeLayer,
  tabTick,
  setTabTick,
  brushTool,
  isCollisionLayer,
  _brushToolbarExpanded,
  _showBrushToolbarTemporarily,
  _setBrushToolbarNode,
  handleFileUpload: propHandleFileUpload,
  handleToggleBrushTool,
  handleDeleteActiveTab: propHandleDeleteActiveTab,
  toast,
  handleOpenActorDialog,
  stampsState
}) => {
  const tileset = useTileset(editor, activeLayer, setTabTick);

  const handleFileUpload = propHandleFileUpload ?? tileset.handleFileUpload;
  const handleDeleteActiveTab = propHandleDeleteActiveTab ?? (() => { void tileset.deleteActiveTab(); });

  // Zoom state lifted from TilesetPalette
  const [zoom, setZoom] = useState<number>(1);
  const [hasSelection, setHasSelection] = useState<boolean>(false);
  const [clearSelectionFn, setClearSelectionFn] = useState<(() => void) | null>(null);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const handleClearSelection = useCallback(() => {
    if (clearSelectionFn) {
      clearSelectionFn();
    }
  }, [clearSelectionFn]);

  // Handler for selection changes from TilesetPalette
  const handleSelectionChange = useCallback((hasSel: boolean, clearFn: () => void) => {
    setHasSelection(hasSel);
    setClearSelectionFn(() => clearFn);
  }, []);

  return (
    <>
      <TilesetPalette
        editor={editor}
        activeLayer={activeLayer}
        tabTick={tabTick}
        setTabTick={setTabTick}
        brushTool={brushTool}
        stampsState={stampsState}
        zoom={zoom}
        setZoom={setZoom}
        onSelectionChange={handleSelectionChange}
      />

      <BrushToolbar
        editor={editor}
        activeLayer={activeLayer}
        isCollisionLayer={isCollisionLayer}
        brushTool={brushTool}
        setTabTick={setTabTick}
        onOpenActorDialog={handleOpenActorDialog}
        onFileUpload={handleFileUpload}
        onToggleBrushTool={handleToggleBrushTool}
        onDeleteActiveTab={handleDeleteActiveTab}
        toast={toast}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onClearSelection={handleClearSelection}
        hasSelection={hasSelection}
        zoom={zoom}
      />
    </>
  );
};

export default TilesetPanel;
