import React from 'react';
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
  brushToolbarExpanded?: boolean;
  showBrushToolbarTemporarily?: () => void;
  setBrushToolbarNode?: (n: HTMLDivElement | null) => void;
  handleFileUpload?: (event: React.ChangeEvent<HTMLInputElement>, type: 'tileset' | 'layerTileset') => void;
  handleToggleBrushTool: (tool: 'move' | 'merge' | 'separate' | 'remove') => void;
  handleDeleteActiveTab?: () => void;
  toast: typeof import('@/hooks/use-toast').toast;
  handleOpenActorDialog: (type: 'npc' | 'enemy') => void;
  stampsState?: unknown;
};

const SidebarTilesetArea: React.FC<Props> = ({
  editor,
  activeLayer,
  tabTick,
  setTabTick,
  brushTool,
  isCollisionLayer,
  brushToolbarExpanded,
  showBrushToolbarTemporarily,
  setBrushToolbarNode,
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

  return (
    <>
      <TilesetPalette editor={editor} activeLayer={activeLayer} tabTick={tabTick} setTabTick={setTabTick} brushTool={brushTool} stampsState={stampsState} />

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
      />
    </>
  );
};

export default SidebarTilesetArea;
