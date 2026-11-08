import React from 'react';
import MapTargetSwitch, { type LayerVisibilityControls } from '@/components/MapTargetSwitch';
import TilesetPalette from '@/components/TilesetPalette';
import BrushToolbar from '@/components/BrushToolbar';
import type { TileLayer } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';

import useTileset from '@/hooks/useTileset';

type Props = {
  editor: TileMapEditor | null;
  activeLayer: TileLayer | null;
  tabTick: number;
  setTabTick: React.Dispatch<React.SetStateAction<number>>;
  brushTool: 'none' | 'move' | 'merge' | 'separate' | 'remove';
  isCollisionLayer: boolean;
  fitToWidth?: boolean;
  mapLayers?: TileLayer[];
  layerVisibility?: LayerVisibilityControls;
  onSelectLayer?: (id: number) => void;
  _brushToolbarExpanded?: boolean;
  _showBrushToolbarTemporarily?: () => void;
  _setBrushToolbarNode?: (n: HTMLDivElement | null) => void;
  handleFileUpload?: (event: React.ChangeEvent<HTMLInputElement>, type: 'tileset' | 'layerTileset') => void;
  handleToggleBrushTool: (tool: 'move' | 'merge' | 'separate' | 'remove') => void;
  handleDeleteActiveTab?: () => void;
  toast: typeof import('@/hooks/use-toast').toast;
  handleOpenActorDialog: (type: 'npc' | 'enemy') => void;
  stampsState?: unknown;
  currentProjectPath?: string | null;
  onShowImportReview?: (data: {
    tilesetFileName: string;
    detectedAssets: Array<{
      gid: number;
      sourceX: number;
      sourceY: number;
      width: number;
      height: number;
      confidence?: number;
    }>;
  }) => void;
};

const TilesetPanel: React.FC<Props> = ({
  editor,
  activeLayer,
  tabTick,
  setTabTick,
  brushTool,
  isCollisionLayer,
  fitToWidth,
  mapLayers,
  layerVisibility,
  onSelectLayer,
  _brushToolbarExpanded,
  _showBrushToolbarTemporarily,
  _setBrushToolbarNode,
  handleFileUpload: propHandleFileUpload,
  handleToggleBrushTool,
  handleDeleteActiveTab: propHandleDeleteActiveTab,
  toast,
  handleOpenActorDialog,
  stampsState,
  currentProjectPath,
  onShowImportReview
}) => {
  console.log('[TilesetPanel] Rendered with:', {
    editorExists: !!editor,
    activeLayerType: activeLayer?.type || 'none',
    brushTool,
    onShowImportReview: !!onShowImportReview
  });
  const tileset = useTileset(editor, activeLayer, setTabTick);

  const handleFileUpload = propHandleFileUpload ?? tileset.handleFileUpload;
  const handleDeleteActiveTab = propHandleDeleteActiveTab ?? (() => { void tileset.deleteActiveTab(); });
  console.log('[TilesetPanel] Will pass to BrushToolbar - editor:', !!editor, 'activeLayer:', !!activeLayer);

  return (
    <>
      <TilesetPalette editor={editor} activeLayer={activeLayer} tabTick={tabTick} setTabTick={setTabTick} brushTool={brushTool} stampsState={stampsState} fitToWidth={fitToWidth} />

      {mapLayers && onSelectLayer && (
        <MapTargetSwitch layers={mapLayers} activeLayer={activeLayer} onSelectLayer={onSelectLayer} visibility={layerVisibility} />
      )}

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
        currentProjectPath={currentProjectPath}
        onShowImportReview={onShowImportReview}
      />
    </>
  );
};

export default TilesetPanel;
